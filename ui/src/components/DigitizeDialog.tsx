import { Ban, Brush, Clipboard, Contrast, Eye, EyeOff, Grid3x3, Image as ImageIcon, ImageUp, Lock, Maximize2, MousePointerClick, Palette, PenLine, Pipette, RotateCcw, ScanEye, ScanLine, ScanText, Shapes, Sparkle, Sparkles, Trash2, Unlock, Waves, Rainbow, Disc3, Grid2x2, type LucideIcon } from "lucide-react";
import { StitchContour, StitchCross, StitchFill, StitchMeander, StitchRadial, StitchSatin, StitchSpiral } from "../icons/stitch";
import { edgeMapImage, toBase64, type EdgeMapData, type SamPoint, type TextLine } from "../lib/mlUtil";
import type { SamImage } from "../lib/ml";

// the model runtime (ONNX Runtime, Tesseract) loads only when the digitizer uses it
const ml = () => import("../lib/ml");
import { createLettering } from "../lib/textOps";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { engine } from "../engine/client";
import { pending } from "../lib/actions";
import { fillMethodDefaults, objectBounds, transformObject, translateMat, uid, unionBoxes } from "../lib/geometry";
import { openFile } from "../lib/platform";
import { DesignView } from "../canvas/DesignView";
import {
  backdropOf,
  backdropPatch,
  DETAIL,
  detailOf,
  DIGITIZE_DEFAULTS,
  DIGITIZE_PRESETS,
  migrateSettings,
  OUTLINE_DEFAULT_MM,
  outlinesOf,
  outlinesPatch,
  presetOf,
  presetSettings,
  type Backdrop,
  type Detail,
  type DigitizeSettings,
  type Outlines,
  type PresetId,
} from "../lib/digitizePresets";
import { CROSS_DEFAULTS, crossStitchDesign, type CrossSettings } from "../lib/crossStitch";
import { CROSS_KINDS } from "./CrossStitchAssistant";
import { emptyDoc, useStore } from "../store";
import { REGION_REASON, type ColorInfo, type DigitizeOptions, type DigitizePreview, type DigitizeResult, type FillMethod, type PaletteEntry, type PlanData, type RegionEdit, type SegMask } from "../types";
import { ChartSelect } from "./ThreadPicker";
import { RegionEditor, regionAt } from "./RegionEditor";
import { chartLabel, loadChart } from "../lib/threads";
import { Dialog, fmtTime, Num, Row, Slider, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t, tn, useLanguage } from "../nova/i18n/filum";

type Rgb = [number, number, number];

type Settings = DigitizeSettings;
const DEFAULTS = DIGITIZE_DEFAULTS;

/** What a colour becomes: decided from the picture, or chosen. */
type Role = "auto" | "fill" | "line" | "omit";
const ROLES: { id: Role; icon: ReactNode; label: string; hint: string }[] = [
  { id: "auto", icon: <Sparkles size={12} />, get label() { return t("filum.digitalizza.auto"); }, get hint() { return t("filum.digitalizza.decided_from_the_picture_thin"); } },
  { id: "fill", icon: <StitchFill size={12} />, get label() { return t("filum.digitalizza.fill"); }, get hint() { return t("filum.digitalizza.always_a_fill_never_lines"); } },
  { id: "line", icon: <PenLine size={12} />, get label() { return t("filum.digitalizza.line"); }, get hint() { return t("filum.digitalizza.always_lines_along_the_centre"); } },
  { id: "omit", icon: <EyeOff size={12} />, get label() { return t("filum.digitalizza.omit"); }, get hint() { return t("filum.digitalizza.leave_this_colour_out"); } },
];

const PRESET_ICONS: Record<PresetId, ReactNode> = {
  logo: <Shapes size={16} />,
  illustration: <Brush size={16} />,
  drawing: <PenLine size={16} />,
  photo: <ImageIcon size={16} />,
  pixel: <Grid3x3 size={16} />,
};

const FILL_METHODS: { id: FillMethod; icon: LucideIcon; label: string; hint: string }[] = [
  { id: "tatami", icon: StitchFill, get label() { return t("filum.digitalizza.tatami"); }, get hint() { return t("filum.digitalizza.parallel_staggered_rows_the_classic"); } },
  { id: "flow", icon: Waves, get label() { return t("filum.digitalizza.flow"); }, get hint() { return t("filum.digitalizza.rows_bend_with_the_picture"); } },
  { id: "curved", icon: Rainbow, get label() { return t("filum.digitalizza.curved"); }, get hint() { return t("filum.digitalizza.rows_follow_the_outline_of"); } },
  { id: "contour", icon: StitchContour, get label() { return t("filum.digitalizza.contour"); }, get hint() { return t("filum.digitalizza.rings_that_follow_the_outline"); } },
  { id: "spiral", icon: StitchSpiral, get label() { return t("filum.digitalizza.spiral"); }, get hint() { return t("filum.digitalizza.one_continuous_spiral_from_the"); } },
  { id: "radial", icon: StitchRadial, get label() { return t("filum.digitalizza.sunburst"); }, get hint() { return t("filum.digitalizza.rays_from_the_centre_of"); } },
  { id: "circular", icon: Disc3, get label() { return t("filum.digitalizza.circular"); }, get hint() { return t("filum.digitalizza.a_spiral_around_the_centre"); } },
  { id: "meander", icon: StitchMeander, get label() { return t("filum.digitalizza.meander"); }, get hint() { return t("filum.digitalizza.a_quilted_random_walk_light"); } },
  { id: "hilbert", icon: Grid2x2, get label() { return t("filum.digitalizza.hilbert"); }, get hint() { return t("filum.digitalizza.a_space_filling_curve_texture"); } },
  { id: "stipple", icon: Sparkle, get label() { return t("filum.digitalizza.stipple"); }, get hint() { return t("filum.digitalizza.scattered_points_joined_into_one"); } },
];

/** Row direction: per region, from the picture, or one fixed angle. Flow fills lean to it. */
type Direction = "axis" | "image" | "fixed";
const DIRECTIONS = (): [Direction, string, string][] => [
  ["axis", t("filum.digitalizza.per_shape"), t("filum.digitalizza.rows_run_along_the_long")],
  ["image", t("filum.digitalizza.picture"), t("filum.digitalizza.rows_follow_the_dominant_direction")],
  ["fixed", t("filum.digitalizza.fixed"), t("filum.digitalizza.one_angle_for_every_shape")],
];
/** Lines added on top of the fills: colour edges or a line drawing of the picture. */
type ExtraLines = "none" | "colour" | "coherent" | "edges" | "drawing";
const EXTRA = (): [ExtraLines, ReactNode, string, string][] => [
  ["none", <Ban key="n" size={15} />, t("filum.digitalizza.none"), t("filum.digitalizza.only_the_lines_found_in")],
  ["colour", <Contrast key="c" size={15} />, t("filum.digitalizza.colour_edges"), t("filum.digitalizza.a_line_along_every_edge")],
  ["coherent", <Waves key="w" size={15} />, t("filum.digitalizza.coherent"), t("filum.digitalizza.a_drawing_that_follows_the")],
  ["edges", <ScanLine key="e" size={15} />, t("filum.digitalizza.ai_edges"), t("filum.digitalizza.learned_edges_dexined_on_device")],
  ["drawing", <Brush key="d" size={15} />, t("filum.digitalizza.ai_drawing"), t("filum.digitalizza.a_learned_line_drawing_informative")],
];

/** Fills whose rows have a direction (meander: the pattern's rotation). */
const DIRECTED: FillMethod[] = ["tatami", "flow", "curved", "meander"];

const MASK_MODES = (): [SegMask["mode"], string, string][] => [
  ["keep", t("filum.digitalizza.keep"), t("filum.digitalizza.stitch_only_the_selected_objects")],
  ["remove", t("filum.digitalizza.remove"), t("filum.digitalizza.never_stitch_this_leaves_a")],
  ["erase", t("filum.digitalizza.erase"), t("filum.digitalizza.remove_it_and_fill_the")],
  ["separate", t("filum.digitalizza.separate"), t("filum.digitalizza.its_own_objects_even_where")],
];

type Pane = "style" | "colours" | "shapes" | "lines" | "stitches" | "cross" | "ai";
const PANES: { id: Pane; label: string; hint: string; icon: ReactNode }[] = [
  { id: "style", get label() { return t("filum.digitalizza.style"); }, get hint() { return t("filum.digitalizza.output_preset_the_look_and"); }, icon: <Sparkles size={15} /> },
  { id: "colours", get label() { return t("filum.digitalizza.colours"); }, get hint() { return t("filum.digitalizza.palette_thread_chart_and_background"); }, icon: <Palette size={15} /> },
  { id: "shapes", get label() { return t("filum.digitalizza.shapes"); }, get hint() { return t("filum.digitalizza.tracing_and_cleanup"); }, icon: <Shapes size={15} /> },
  { id: "lines", get label() { return t("filum.digitalizza.lines"); }, get hint() { return t("filum.digitalizza.satin_strokes_line_art_and"); }, icon: <StitchSatin size={15} /> },
  { id: "stitches", get label() { return t("filum.digitalizza.stitches"); }, get hint() { return t("filum.digitalizza.fill_method_density_and_direction"); }, icon: <StitchFill size={15} /> },
  { id: "cross", get label() { return t("filum.digitalizza.crosses"); }, get hint() { return t("filum.digitalizza.cell_size_kind_of_cross"); }, icon: <StitchCross size={15} /> },
  { id: "ai", get label() { return t("filum.digitalizza.ai"); }, get hint() { return t("filum.digitalizza.select_objects_and_find_text"); }, icon: <ScanEye size={15} /> },
];

/** The tab of every remembered option (the compiler checks that none is missing). */
const PANE_OF: Record<keyof Settings, Pane> = {
  maxPixels: "shapes",
  denoise: "shapes",
  pixelArt: "shapes",
  colors: "colours",
  mergeDeltaE: "colours",
  removeBackground: "colours",
  backgroundScope: "colours",
  seamless: "shapes",
  cornerAngle: "shapes",
  gradients: "shapes",
  smoothing: "shapes",
  minRegionMm2: "shapes",
  simplifyMm: "shapes",
  overlapMm: "shapes",
  allowSatin: "lines",
  satinMaxWidthMm: "lines",
  allowRunning: "lines",
  runningMaxWidthMm: "lines",
  lineArt: "lines",
  lineStrength: "lines",
  lineNetworks: "lines",
  lineMaxWidthMm: "lines",
  inkSensitivity: "lines",
  lineGapMm: "lines",
  lineMinMm: "lines",
  lineContinuity: "lines",
  lineTaper: "lines",
  thinTriple: "lines",
  lineSubpixel: "lines",
  outlineLineMm: "lines",
  routeLines: "lines",
  photoZigzag: "style",
  photoSpacing: "style",
  photoAngle: "style",
  photoContrast: "style",
  photoMin: "style",
  edgeOutlines: "lines",
  edgeContrast: "lines",
  outline: "style",
  outlineWidthMm: "style",
  outlineColor: "lines",
  fillMethod: "stitches",
  fillAngle: "stitches",
  rowSpacing: "stitches",
  underlay: "stitches",
  fillDirection: "stitches",
  flowDetail: "stitches",
  flowSmoothing: "stitches",
  flowStrength: "stitches",
  gradientFlow: "shapes",
};
const PANE_KEY = "filum.digitize.pane";

/** What the picture becomes: traced shapes (fills, satins, lines) or cross stitch on a grid. */
type Output = "shapes" | "cross";
const OUTPUT_KEY = "filum.digitize.output";
const CROSS_KEY = "filum.digitize.cross";
/** Panes of each output (cross stitch: no tracing, lines or fill methods). */
const PANES_OF: Record<Output, Pane[]> = { shapes: ["style", "colours", "shapes", "lines", "stitches", "ai"], cross: ["style", "colours", "cross", "ai"] };
const loadCross = (): CrossSettings => {
  try {
    return { ...CROSS_DEFAULTS, ...JSON.parse(localStorage.getItem(CROSS_KEY) ?? "{}") };
  } catch {
    return CROSS_DEFAULTS;
  }
};
/** Cross stitch preset: the colour stage's settings that suit a grid of crosses. */
const CROSS_PRESET: Partial<Settings> = { photoZigzag: false, gradients: false, colors: 8, denoise: 1, mergeDeltaE: 3, removeBackground: true };

function Group({ title, hint, extra, children }: { title: string; hint?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="dz-group">
      <header>
        <h4>{title}</h4>
        {extra}
      </header>
      {children}
      {hint && <p className="dz-hint">{hint}</p>}
    </section>
  );
}

function Seg<T extends string>({ value, options, onChange, full, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; full?: boolean; disabled?: boolean }) {
  return (
    <div className={`seg ${full ? "seg-full" : ""} ${disabled ? "disabled" : ""}`}>
      {options.map(([k, label]) => (
        <button key={k} className={value === k ? "on" : ""} disabled={disabled} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Paint the image with the current mask and click points (object selection). */
function drawSam(ctx: CanvasRenderingContext2D, dpr: number, bmp: ImageBitmap, sam: SamImage | null, mask: Uint8Array | null, pts: SamPoint[], masks: { mode: string; px: Uint8Array; w: number; h: number }[]) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const k = Math.min((W - 24 * dpr) / bmp.width, (H - 24 * dpr) / bmp.height);
  const x0 = (W - bmp.width * k) / 2;
  const y0 = (H - bmp.height * k) / 2;
  ctx.drawImage(bmp, x0, y0, bmp.width * k, bmp.height * k);
  const overlay = (px: Uint8Array, w: number, h: number, rgb: [number, number, number], a: number) => {
    const id = new ImageData(w, h);
    for (let i = 0; i < px.length; i++) if (px[i]) id.data.set([rgb[0], rgb[1], rgb[2], a], i * 4);
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    t.getContext("2d")!.putImageData(id, 0, 0);
    ctx.drawImage(t, x0, y0, bmp.width * k, bmp.height * k);
  };
  const col: Record<string, [number, number, number]> = { keep: [40, 160, 90], remove: [200, 50, 60], separate: [230, 150, 30] };
  for (const m of masks) overlay(m.px, m.w, m.h, col[m.mode] ?? [120, 120, 120], 90);
  if (mask && sam) overlay(mask, sam.w, sam.h, [40, 120, 230], 120);
  if (sam)
    for (const q of pts) {
      const cx = x0 + (q.x / sam.w) * bmp.width * k;
      const cy = y0 + (q.y / sam.h) * bmp.height * k;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = q.label ? "#2e9d5b" : "#c8323c";
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
}

const SETTINGS_KEY = "filum.digitize.v2";
const loadSettings = (): Settings => {
  try {
    return migrateSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"));
  } catch {
    return DEFAULTS;
  }
};

const hexToRgb = (h: string): Rgb => {
  const v = parseInt(h.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgbToHex = (c: number[]) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
const sameRgb = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

interface Img {
  name: string;
  bytes: Uint8Array;
  url: string;
}

type Tab = "original" | "colours" | "stitches" | "vector";

function useBoxSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 600, h: 420 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function PreviewCanvas({ draw, w, h }: { draw: (ctx: CanvasRenderingContext2D, dpr: number) => void; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    draw(c.getContext("2d")!, dpr);
  }, [draw, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} />;
}

export function DigitizeDialog({ onClose }: { onClose: () => void }) {
  useLanguage();
  const doc = useStore((s) => s.doc);
  const fabricColor = useStore((s) => s.fabricColor);
  const [img, setImg] = useState<Img | null>(() => {
    const p = pending.image;
    pending.image = null;
    return p ? { ...p, url: URL.createObjectURL(new Blob([p.bytes as BlobPart])) } : null;
  });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [output, setOutputState] = useState<Output>(() => {
    const o = pending.output ?? (localStorage.getItem(OUTPUT_KEY) as Output | null);
    pending.output = null;
    return o === "cross" ? "cross" : "shapes";
  });
  const [cross, setCrossState] = useState<CrossSettings>(loadCross);
  const setCross = (p: Partial<CrossSettings>) => setCrossState((c) => ({ ...c, ...p }));
  useEffect(() => void safeSetItem(CROSS_KEY, JSON.stringify(cross)), [cross]);
  const [widthMm, setWidthMm] = useState(() => Math.round(doc.hoop.width * 0.8));
  const [fixedColors, setFixedColors] = useState<Rgb[]>([]);
  const [skipColors, setSkipColors] = useState<Rgb[]>([]);
  const [lineColors, setLineColors] = useState<Rgb[]>([]);
  const [fillColors, setFillColors] = useState<Rgb[]>([]);
  /** Colours with a satin edge in their own thread (where they meet the background). */
  const [edgeColors, setEdgeColors] = useState<Rgb[]>([]);
  /** The sew order by colour (empty: the digitizer's own, largest colour first). */
  const [colorOrder, setColorOrder] = useState<Rgb[]>([]);
  /** Areas clicked in the region editor (stitch / leave out), for this image. */
  const [regionEdits, setRegionEdits] = useState<RegionEdit[]>([]);
  /** Thread recolouring: quantised colour (hex) → chosen thread colour (hex). */
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [chart, setChart] = useState("");
  const [chartEntries, setChartEntries] = useState<PaletteEntry[]>([]);
  const [preview, setPreview] = useState<DigitizePreview | null>(null);
  /** The traced result (shapes output). */
  const [traced, setTraced] = useState<DigitizeResult | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [tab, setTab] = useState<Tab>("stitches");
  const [stitchLook, setStitchLook] = useState<"realistic" | "stitch">("realistic");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Picking colours on the picture: the role a click gives. */
  const [pickRole, setPickRole] = useState<Exclude<Role, "auto"> | null>(null);
  const eyedropper = pickRole !== null;
  const [placement, setPlacement] = useState<"add" | "replace">("add");
  // the preset the settings still match (any change makes them custom)
  const preset = presetOf(settings);
  // recognition (on-device AI): object masks, edges, text
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [sam, setSam] = useState<SamImage | null>(null);
  const [samMode, setSamMode] = useState(false);
  const [samPts, setSamPts] = useState<SamPoint[]>([]);
  const [curMask, setCurMask] = useState<Uint8Array | null>(null);
  const [masks, setMasks] = useState<{ mode: SegMask["mode"]; px: Uint8Array; w: number; h: number }[]>([]);
  const [edgeMap, setEdgeMap] = useState<EdgeMapData | null>(null);
  /** Which model made the edge map (learned edges or a learned line drawing). */
  const [edgeKind, setEdgeKind] = useState<"edges" | "drawing" | null>(null);
  const [textLines, setTextLines] = useState<TextLine[] | null>(null);
  const [textPick, setTextPick] = useState<boolean[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef);
  const imgRef = useRef<HTMLImageElement>(null);
  const runId = useRef(0);
  // the picture now (async work checks it is still the one it started on)
  const picRef = useRef(img);
  picRef.current = img;
  const mounted = useRef(false);

  const set = (p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }));
  };
  const [paneState, setPaneState] = useState<Pane>(() => {
    const v = localStorage.getItem(PANE_KEY);
    return PANES.some((p) => p.id === v) ? (v as Pane) : "style";
  });
  const panes = PANES.filter((p) => PANES_OF[output].includes(p.id));
  // a pane the output does not have shows its closest one
  const pane: Pane = PANES_OF[output].includes(paneState) ? paneState : output === "cross" && ["shapes", "lines", "stitches"].includes(paneState) ? "cross" : output === "shapes" && paneState === "cross" ? "stitches" : "style";
  const setPane = (p: Pane) => {
    setPaneState(p);
    safeSetItem(PANE_KEY, p);
  };
  const setOutput = (o: Output) => {
    setOutputState(o);
    safeSetItem(OUTPUT_KEY, o);
  };
  const direction: Direction = settings.fillAngle != null ? "fixed" : settings.fillDirection === "image" ? "image" : "axis";

  useEffect(() => void safeSetItem(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  useEffect(() => {
    setSam(null);
    setSamPts([]);
    setCurMask(null);
    setMasks([]);
    setEdgeMap(null);
    setTextLines(null);
    setTextPick([]);
    setSamMode(false);
    // the old picture's bitmap is closed below: nothing may use it meanwhile
    setBmp(null);
    if (!img) return;
    let live = true;
    let made: ImageBitmap | null = null;
    createImageBitmap(new Blob([img.bytes as BlobPart])).then((b) => {
      made = b;
      if (live) setBmp(b);
      else b.close();
    });
    return () => {
      live = false;
      made?.close();
      // the picture is replaced or the dialog closes: its memory goes (checked a
      // moment later: a development re-run of this effect keeps the same picture)
      setTimeout(() => {
        if (picRef.current !== img || !mounted.current) URL.revokeObjectURL(img.url);
      }, 0);
    };
  }, [img]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // learned edges for line art
  const wantMap = settings.lineArt === "edges" || settings.lineArt === "drawing" ? settings.lineArt : null;
  useEffect(() => {
    if (!wantMap || !bmp || (edgeMap && edgeKind === wantMap)) return;
    let live = true;
    setBusy(wantMap === "drawing" ? "Drawing lines (AI)…" : "Detecting edges (AI)…");
    ml()
      .then((m) => (wantMap === "drawing" ? m.drawLines(bmp) : m.detectEdges(bmp)))
      .then((e) => {
        if (!live) return;
        setEdgeMap(e);
        setEdgeKind(wantMap);
      })
      .catch((e: Error) => live && setError((wantMap === "drawing" ? t("filum.digitalizza.line_drawing_model") : t("filum.digitalizza.edge_model")) + e.message))
      .finally(() => live && setBusy(null));
    return () => {
      live = false;
    };
  }, [wantMap, bmp, edgeMap, edgeKind]);

  // text to replace: removed from the stitched shapes (becomes lettering on add)
  const textMask = useMemo<SegMask | null>(() => {
    if (!bmp || !textLines || !textPick.some(Boolean)) return null;
    const k = 512 / Math.max(bmp.width, bmp.height);
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const px = new Uint8Array(w * h);
    textLines.forEach((l, i) => {
      if (!textPick[i]) return;
      const pad = (l.bbox.y1 - l.bbox.y0) * 0.15;
      for (let y = Math.max(0, Math.floor((l.bbox.y0 - pad) * k)); y < Math.min(h, Math.ceil((l.bbox.y1 + pad) * k)); y++)
        for (let x = Math.max(0, Math.floor((l.bbox.x0 - pad) * k)); x < Math.min(w, Math.ceil((l.bbox.x1 + pad) * k)); x++) px[y * w + x] = 255;
    });
    return { mode: "erase", width: w, height: h, data: toBase64(px) };
  }, [bmp, textLines, textPick]);

  const segMasks = useMemo<SegMask[]>(
    () => [...masks.map((m) => ({ mode: m.mode, width: m.w, height: m.h, data: toBase64(m.px) })), ...(textMask ? [textMask] : [])],
    [masks, textMask],
  );

  const startSam = async () => {
    if (!bmp) return;
    setTab("original");
    setSamMode(true);
    if (sam) return;
    const forImg = picRef.current;
    try {
      setBusy("Analysing objects (AI)…");
      const enc = await (await ml()).samEncode(bmp);
      // another picture was loaded meanwhile: this analysis is of the old one
      if (picRef.current !== forImg) return;
      setSam(enc);
    } catch (e) {
      setError(t("filum.digitalizza.segmentation_model") + (e as Error).message);
      setSamMode(false);
    } finally {
      setBusy(null);
    }
  };
  const samClick = async (pt: SamPoint) => {
    if (!sam) return;
    const pts = [...samPts, pt];
    setSamPts(pts);
    const forImg = picRef.current;
    try {
      const mask = await (await ml()).samMask(sam, pts);
      if (picRef.current === forImg) setCurMask(mask);
    } catch (e) {
      setError(t("filum.digitalizza.segmentation_model") + (e as Error).message);
    }
  };
  const useMask = (mode: SegMask["mode"]) => {
    if (!sam || !curMask) return;
    setMasks([...masks, { mode, px: curMask, w: sam.w, h: sam.h }]);
    setSamPts([]);
    setCurMask(null);
  };
  const runOcr = async () => {
    if (!img) return;
    const forImg = img;
    try {
      setBusy("Reading text (AI)…");
      const lines = await (await ml()).findText(img.bytes);
      if (picRef.current !== forImg) return;
      setTextLines(lines);
      setTextPick(lines.map(() => false));
      if (!lines.length) useStore.getState().toast(t("filum.digitalizza.no_text_found"));
    } catch (e) {
      setError(t("filum.digitalizza.text_recognition") + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const opts = useMemo<Partial<DigitizeOptions>>(
    () => ({
      ...settings,
      widthMm,
      fixedColors,
      skipColors,
      lineColors,
      fillColors,
      edgeColors,
      colorOrder,
      palette: chartEntries,
      paletteBrand: chart ? chartLabel(chart) : "",
      masks: segMasks,
      edgeMap: wantMap && edgeKind === wantMap ? edgeMap : null,
      regionEdits,
      // cross stitch: flat colours only (gradients and zig-zag photos are shapes)
      ...(output === "cross" ? { gradients: false, photoZigzag: false } : {}),
    }),
    [output, settings, widthMm, fixedColors, skipColors, lineColors, fillColors, edgeColors, colorOrder, chartEntries, chart, segMasks, edgeMap, edgeKind, wantMap, regionEdits],
  );

  // live pipeline: colour preview (fast) → digitize → stitch plan
  useEffect(() => {
    if (!img) return;
    const id = ++runId.current;
    // busy from the change on: Add can't take the result of the settings before
    setBusy("Reducing colours…");
    const t = setTimeout(async () => {
      try {
        setError(null);
        setBusy("Reducing colours…");
        const p = await engine.digitizePreview(img.bytes, opts);
        if (id !== runId.current) return;
        setPreview(p);
        // cross stitch is laid on the grid from the colours (below): no tracing
        if (output === "cross") {
          setTraced(null);
          setBusy(null);
          return;
        }
        setBusy("Building stitches…");
        const r = await engine.digitize(img.bytes, opts);
        if (id !== runId.current) return;
        setTraced(r);
        if (!r.objects.length) setBusy(null);
      } catch (e) {
        if (id === runId.current) {
          setError((e as Error).message);
          setBusy(null);
        }
      }
    }, 220);
    return () => clearTimeout(t);
  }, [img, opts, output]);

  // cross stitch: the colour stage's regions on a grid of cells
  const crossed = useMemo(() => {
    if (output !== "cross" || !preview) return null;
    return crossStitchDesign(
      { ...preview, colours: preview.colors.length, colors: preview.colors },
      cross,
      chart ? chartLabel(chart) : "",
      img?.name.replace(/\.[^.]+$/, "") || "Cross stitch",
      () => uid(),
    );
  }, [output, preview, cross, chart, img]);
  const result = useMemo<DigitizeResult | null>(
    () => (output === "cross" ? (crossed && preview ? { threads: crossed.threads, objects: crossed.objects, colors: preview.colors, widthMm: preview.widthMm, heightMm: preview.heightMm } : null) : traced),
    [output, crossed, preview, traced],
  );

  // thread recolouring is applied on top of the engine result (shapes stay put)
  const recoloured = useMemo<DigitizeResult | null>(() => {
    if (!result) return null;
    const ov = (hex: string) => overrides[hex.toLowerCase()];
    return {
      ...result,
      threads: result.threads.map((t) => (ov(t.color) ? { ...t, color: ov(t.color), name: ov(t.color).toUpperCase(), code: "", brand: "" } : t)),
    };
  }, [result, overrides]);

  // the result as a design: what the previews show and the plan is made of
  const previewDoc = useMemo(
    () => (recoloured ? { ...emptyDoc(), fabric: doc.fabric, options: doc.options, threads: recoloured.threads, objects: recoloured.objects } : null),
    [recoloured, doc.fabric, doc.options],
  );
  // stitch plan of the (recoloured) result — object geometry is cached by the engine
  const planRun = useRef(0);
  useEffect(() => {
    if (!recoloured?.objects.length) {
      // a plan still being made for the previous result is dropped
      planRun.current++;
      setPlan(null);
      return;
    }
    const id = ++planRun.current;
    // a settings change meanwhile starts a new run, which owns the busy state
    const run = runId.current;
    setBusy("Building stitches…");
    engine
      .planDetached(previewDoc!)
      .then((pl) => id === planRun.current && setPlan(pl))
      .catch((e: Error) => id === planRun.current && setError(e.message))
      .finally(() => id === planRun.current && run === runId.current && setBusy(null));
  }, [previewDoc]);

  // inputs: file picker, drag & drop, paste
  const loadBytes = useCallback((name: string, bytes: Uint8Array) => {
    // the colour choices belong to the old picture
    setOverrides({});
    setFixedColors([]);
    setSkipColors([]);
    setLineColors([]);
    setFillColors([]);
    setEdgeColors([]);
    setColorOrder([]);
    setRegionEdits([]);
    setTraced(null);
    setPlan(null);
    setPreview(null);
    setImg({ name, bytes, url: URL.createObjectURL(new Blob([bytes as BlobPart])) });
    setTab("stitches");
  }, []);
  const pick = async () => {
    const f = await openFile([{ name: t("filum.digitalizza.images"), extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }]);
    if (f) loadBytes(f.name, f.bytes);
  };
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await it.getType(type);
          return loadBytes("pasted image", new Uint8Array(await blob.arrayBuffer()));
        }
      }
      useStore.getState().toast(t("filum.digitalizza.no_image_on_the_clipboard"));
    } catch {
      useStore.getState().toast(t("filum.digitalizza.clipboard_access_was_denied_press"));
    }
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) f.arrayBuffer().then((b) => loadBytes(f.name || "pasted image", new Uint8Array(b)));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadBytes]);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (f) loadBytes(f.name, new Uint8Array(await f.arrayBuffer()));
  };

  // thread chart
  useEffect(() => {
    if (!chart) return setChartEntries([]);
    let cancel = false;
    loadChart(chart)
      .then((es) => !cancel && setChartEntries(es.map((e) => ({ name: e.name, code: e.code, rgb: hexToRgb(e.color) }))))
      .catch(() => useStore.getState().toast(t("filum.digitalizza.could_not_load_thread_chart"), "error"));
    return () => {
      cancel = true;
    };
  }, [chart]);

  const colors: ColorInfo[] = result?.colors ?? preview?.colors ?? [];
  const aspect = preview ? preview.heightMm / Math.max(preview.widthMm, 1e-9) : 0.75;
  const heightMm = widthMm * aspect;

  /** Whether a picked colour stands for this quantised colour. */
  const isColour = (x: Rgb, c: ColorInfo) => sameRgb(nearestSkipTarget(x), c.rgb);
  const roleOf = (c: ColorInfo): Role =>
    c.background ? "omit" : lineColors.some((x) => isColour(x, c)) ? "line" : fillColors.some((x) => isColour(x, c)) ? "fill" : "auto";
  const setRole = (c: ColorInfo, role: Role) => {
    const without = (list: Rgb[]) => list.filter((x) => !isColour(x, c));
    // the auto-detected background is left out by the background switch, not a list
    const autoBackground = c.background && !skipColors.some((x) => isColour(x, c));
    setLineColors(role === "line" ? [...without(lineColors), c.rgb] : without(lineColors));
    setFillColors(role === "fill" ? [...without(fillColors), c.rgb] : without(fillColors));
    setSkipColors(role === "omit" && !autoBackground ? [...without(skipColors), c.rgb] : without(skipColors));
    if (role !== "omit" && autoBackground) set({ removeBackground: false });
  };
  const toggleColour = (c: ColorInfo) => setRole(c, c.background ? "auto" : "omit");
  const hasEdge = (c: ColorInfo) => edgeColors.some((x) => isColour(x, c));
  const toggleEdge = (c: ColorInfo) => setEdgeColors(hasEdge(c) ? edgeColors.filter((x) => !isColour(x, c)) : [...edgeColors, c.rgb]);
  /** Move a thread of the result one place earlier (-1) or later (+1) in the sew order. */
  const moveThread = (i: number, by: -1 | 1) => {
    const list = (result?.threads ?? []).map((t) => hexToRgb(t.color));
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setColorOrder(list);
  };
  // which quantised colour a skip entry hits (mirrors the engine's nearest match)
  const nearestSkipTarget = (s: Rgb): Rgb => {
    let best = colors[0]?.rgb ?? s;
    let bd = Infinity;
    for (const c of colors) {
      const d = (c.rgb[0] - s[0]) ** 2 + (c.rgb[1] - s[1]) ** 2 + (c.rgb[2] - s[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = c.rgb;
      }
    }
    return best;
  };
  // Choosing a different thread colour recolours that region; the palette is
  // locked so the regions themselves stay exactly where they are.
  const editColour = (i: number, hex: string) => {
    if (!fixedColors.length) lockPalette();
    setOverrides({ ...overrides, [colors[i].hex.toLowerCase()]: hex.toLowerCase() });
  };
  const removeColour = (i: number) => {
    const base = fixedColors.length ? fixedColors : colors.map((c) => c.rgb);
    if (base.length <= 2) return;
    setFixedColors(base.filter((_, k) => k !== i));
  };
  const lockPalette = () => setFixedColors(colors.map((c) => c.rgb));
  /** Click in the region editor: flip one area (a single edit per area), or the whole colour. */
  const toggleRegion = (fx: number, fy: number, region: number, wholeColour: boolean) => {
    if (!preview) return;
    const label = preview.regionLabel[region];
    if (wholeColour && colors[label]) return toggleColour(colors[label]);
    if (pickRole && colors[label]) return setRole(colors[label], pickRole);
    const stitched = preview.regionReason[region] === REGION_REASON.stitched;
    const rest = regionEdits.filter((e) => regionAt(preview, e.x, e.y) !== region);
    setRegionEdits([...rest, { x: fx, y: fy, keep: !stitched }]);
  };
  const removedShare = colors.reduce((a, c) => a + (c.removed ?? 0), 0);
  const resetColours = () => {
    setFixedColors([]);
    setSkipColors([]);
    setLineColors([]);
    setFillColors([]);
    setEdgeColors([]);
    setColorOrder([]);
    setPickRole(null);
    setOverrides({});
    set({ removeBackground: true });
  };

  /** Extra lines: colour edges or one line-art source (they are alternatives). */
  const extra: ExtraLines = settings.edgeOutlines !== "none" ? "colour" : settings.lineArt;
  const chooseExtra = (v: ExtraLines) =>
    v === "colour" ? set({ edgeOutlines: settings.edgeOutlines !== "none" ? settings.edgeOutlines : "running", lineArt: "none" }) : set({ edgeOutlines: "none", lineArt: v });
  const outlineColourRow = (
    <Row label={t("filum.digitalizza.colour")} title={t("filum.digitalizza.thread_of_the_colour_edges")}>
      <span className="dz-inline">
        <input type="color" className="color-big" value={rgbToHex(settings.outlineColor)} onChange={(e) => set({ outlineColor: hexToRgb(e.target.value) })} />
        <span className="stat mono">{rgbToHex(settings.outlineColor).toUpperCase()}</span>
      </span>
    </Row>
  );

  /** Settings of a tab that differ from the defaults (AI: masks and picked text lines). */
  const paneChanges = (p: Pane): number => {
    if (p === "ai") return masks.length + textPick.filter(Boolean).length;
    if (p === "cross") return (Object.keys(CROSS_DEFAULTS) as (keyof CrossSettings)[]).filter((k) => cross[k] !== CROSS_DEFAULTS[k]).length;
    let n = (Object.keys(PANE_OF) as (keyof Settings)[]).filter((k) => PANE_OF[k] === p && JSON.stringify(settings[k]) !== JSON.stringify(DEFAULTS[k])).length;
    if (p === "colours") n += (chart ? 1 : 0) + (fixedColors.length || skipColors.length || lineColors.length || fillColors.length || edgeColors.length || colorOrder.length || Object.keys(overrides).length ? 1 : 0) + regionEdits.length;
    return n;
  };
  const resetPane = (p: Pane) => {
    if (p === "cross") return setCrossState(CROSS_DEFAULTS);
    if (p === "ai") {
      setMasks([]);
      setTextPick(textPick.map(() => false));
      setSamPts([]);
      setCurMask(null);
      return;
    }
    const back: Partial<Settings> = {};
    for (const k of Object.keys(PANE_OF) as (keyof Settings)[]) if (PANE_OF[k] === p) (back as Record<string, unknown>)[k] = DEFAULTS[k];
    set(back);
    if (p === "colours") {
      setChart("");
      resetColours();
      setRegionEdits([]);
    }
  };

  const onOriginalClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!eyedropper || !imgRef.current) return;
    const el = imgRef.current;
    const r = el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * el.naturalWidth);
    const y = Math.floor(((e.clientY - r.top) / r.height) * el.naturalHeight);
    const c = document.createElement("canvas");
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(el, 0, 0);
    const d = g.getImageData(x, y, 1, 1).data;
    // the quantised colour under the click gets the role
    const target = nearestSkipTarget([d[0], d[1], d[2]]);
    const ci = colors.find((c) => sameRgb(c.rgb, target));
    if (ci && pickRole) setRole(ci, pickRole);
  };

  const fitHoop = () => {
    const w = Math.min(doc.hoop.width * 0.9, (doc.hoop.height * 0.9) / Math.max(aspect, 1e-6));
    setWidthMm(Math.floor(w));
  };

  const counts = useMemo(() => {
    const c = { fill: 0, satin: 0, running: 0 };
    for (const o of result?.objects ?? []) if (o.stitch.type in c) c[o.stitch.type as keyof typeof c]++;
    return c;
  }, [result]);
  const stats = plan?.stats;
  const tooBig = widthMm > doc.hoop.width || heightMm > doc.hoop.height;

  const add = () => {
    if (!recoloured?.objects.length) return;
    const result = recoloured;
    const s = useStore.getState();
    const box = unionBoxes(result.objects.map(objectBounds));
    let dx = box ? doc.hoop.width / 2 - (box.x + box.w / 2) : 0;
    let dy = box ? doc.hoop.height / 2 - (box.y + box.h / 2) : 0;
    if (output === "cross") {
      // whole cells: the crosses stay on the canvas grid the shapes were cut to
      const sy = cross.square ? cross.cell : cross.cellY;
      dx = Math.round(dx / cross.cell) * cross.cell;
      dy = Math.round(dy / sy) * sy;
    }
    const m = translateMat(dx, dy);
    const remap = new Map<string, string>();
    const threads = result.threads.map((t) => {
      const id = uid("t");
      remap.set(t.id, id);
      return { ...t, id };
    });
    const objs = result.objects.map((o) => ({ ...transformObject(o, m), id: uid(), thread: remap.get(o.thread)! }));
    if (placement === "replace") {
      s.commit((d) => ({ ...d, name: img?.name.replace(/\.[^.]+$/, "") || d.name, threads, objects: objs }));
    } else s.addObjects(objs, threads);
    s.select(objs.map((o) => o.id));
    if (output === "cross") {
      if (cross.grid) s.set({ showGrid: true, gridStep: cross.cell });
      s.toast(t("filum.digitalizza.v1_crosses_in_length_colours", { v1: (crossed?.crosses ?? 0).toLocaleString(), length: threads.length }), "success");
    } else s.toast(t("filum.digitalizza.digitized_length_objects_in_length_", { length: objs.length, length_: threads.length }), "success");
    // recognised text becomes real lettering, placed and sized like the original
    if (bmp && textLines && textPick.some(Boolean)) {
      const mmPerPx = widthMm / bmp.width;
      const g = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      g.canvas.width = bmp.width;
      g.canvas.height = bmp.height;
      g.drawImage(bmp, 0, 0);
      const picked = textLines.filter((_, i) => textPick[i]);
      void (async () => {
        const made = [];
        for (const l of picked) {
          // the darkest colour in the box is the ink
          const bw = Math.max(1, l.bbox.x1 - l.bbox.x0);
          const bh = Math.max(1, l.bbox.y1 - l.bbox.y0);
          const d = g.getImageData(l.bbox.x0, l.bbox.y0, bw, bh).data;
          let best = [0, 0, 0];
          let lum = Infinity;
          for (let i = 0; i < d.length; i += 16) {
            const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
            if (v < lum) {
              lum = v;
              best = [d[i], d[i + 1], d[i + 2]];
            }
          }
          const thread = useStore.getState().ensureThread(rgbToHex(best));
          const anchor = transformObject({ ...objs[0], paths: [{ closed: false, nodes: [{ p: [((l.bbox.x0 + l.bbox.x1) / 2) * mmPerPx, l.bbox.y1 * mmPerPx] }] }] }, m).paths[0].nodes[0].p;
          made.push(...(await createLettering(l.text, anchor, bh * mmPerPx * 0.72, thread)));
        }
        if (made.length) {
          useStore.getState().addObjects(made);
          useStore.getState().toast(tn("filum.digitalizza.added_lettering_objects", picked.length), "success");
        }
      })();
    }
    onClose();
  };

  const pw = Math.max(200, box.w);
  const ph = Math.max(160, box.h);

  return (
    <Dialog
      live
      xwide
      title={t("filum.digitalizza.auto_digitize_image")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={pick}>
            <ImageUp size={14} />{t("filum.digitalizza.choose_image")}
          </button>
          <button className="btn ghost" onClick={pasteFromClipboard} title={t("filum.digitalizza.paste_an_image_ctrl_v")}>
            <Clipboard size={14} />{t("filum.digitalizza.paste")}
          </button>
          <div className="spacer" />
          <select className="select" value={placement} onChange={(e) => setPlacement(e.target.value as "add" | "replace")} aria-label={t("filum.digitalizza.placement")}>
            <option value="add">{t("filum.digitalizza.add_to_design_centred")}</option>
            <option value="replace">{t("filum.digitalizza.replace_current_design")}</option>
          </select>
          <button className="btn" onClick={onClose}>
            {t("filum.digitalizza.cancel")}
          </button>
          <button className="btn primary" disabled={!result?.objects.length || !!busy} onClick={add}>
            {placement === "replace" ? t("filum.digitalizza.replace_design") : t("filum.digitalizza.add_to_design")}
          </button>
        </>
      }
    >
      <div className="dz" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <div className="dz-side">
          <div className="dz-steps" role="tablist">
            {panes.map((p) => {
              const n = paneChanges(p.id);
              return (
                <button key={p.id} role="tab" aria-selected={pane === p.id} className={pane === p.id ? "on" : ""} title={p.hint} onClick={() => setPane(p.id)}>
                  {p.icon}
                  <span>{p.label}</span>
                  {n > 0 && <i className={p.id === "ai" ? "count" : "dot"}>{p.id === "ai" ? n : ""}</i>}
                </button>
              );
            })}
          </div>

          <div className="dz-pane" key={pane}>
            {pane === "style" && (
              <>
                <Group
                  title={t("filum.digitalizza.output")}
                  hint={
                    output === "cross"
                      ? t("filum.digitalizza.the_picture_s_colours_on")
                      : settings.photoZigzag
                        ? t("filum.digitalizza.one_colour_rows_of_zigzags")
                        : t("filum.digitalizza.traced_shapes_fills_satin_columns")
                  }
                >
                  <Seg
                    full
                    value={output === "cross" ? "cross" : settings.photoZigzag ? "zigzag" : "shapes"}
                    onChange={(v) => {
                      if (v === "cross") {
                        setOutput("cross");
                        setSettings((s) => ({ ...s, ...CROSS_PRESET }));
                      } else {
                        setOutput("shapes");
                        set({ photoZigzag: v === "zigzag" });
                      }
                    }}
                    options={[
                      ["shapes", t("filum.digitalizza.shapes")],
                      ["zigzag", t("filum.digitalizza.zig_zag_photo")],
                      ["cross", t("filum.digitalizza.cross_stitch")],
                    ]}
                  />
                </Group>
                {output === "shapes" && !settings.photoZigzag && (
                  <Group title={t("filum.digitalizza.preset")} hint={DIGITIZE_PRESETS.find((p) => p.id === preset)?.hint ?? t("filum.digitalizza.custom_settings_pick_a_preset")}>
                    <div className="dz-presets">
                      {DIGITIZE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          className={preset === p.id ? "on" : ""}
                          title={p.hint}
                          aria-pressed={preset === p.id}
                          // a preset starts from the defaults: nothing leaks from the last one
                          onClick={() => setSettings((s) => presetSettings(p.id, { outlineColor: s.outlineColor }))}
                        >
                          {PRESET_ICONS[p.id]}
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </Group>
                )}
                {output === "shapes" && !settings.photoZigzag && (
                  <Group title={t("filum.digitalizza.look")} hint={t("filum.digitalizza.each_control_moves_several_settings")}>
                    <Row label={t("filum.digitalizza.outlines")} title={t("filum.digitalizza.lines_of_the_picture_none")}>
                      <Seg<Outlines>
                        full
                        value={outlinesOf(settings)}
                        onChange={(v) => set(outlinesPatch(v, settings.outlineLineMm || OUTLINE_DEFAULT_MM))}
                        options={[
                          ["off", t("filum.digitalizza.none")],
                          ["drawn", t("filum.digitalizza.as_drawn_2")],
                          ["even", t("filum.digitalizza.even")],
                        ]}
                      />
                    </Row>
                    {outlinesOf(settings) === "even" && (
                      <Row label={t("filum.digitalizza.outline_width")} title={t("filum.digitalizza.every_dark_line_becomes_a")}>
                        <Slider min={0.5} max={4} step={0.1} unit="mm" value={settings.outlineLineMm} onChange={(v) => set({ outlineLineMm: v })} />
                      </Row>
                    )}
                    <Row label={t("filum.digitalizza.detail")} title={t("filum.digitalizza.bold_fewer_simpler_shapes_fine")}>
                      <Seg<Detail | "custom">
                        full
                        value={detailOf(settings) ?? "custom"}
                        onChange={(v) => v !== "custom" && set(DETAIL[v])}
                        options={[
                          ["bold", t("filum.digitalizza.bold")],
                          ["normal", t("filum.digitalizza.normal")],
                          ["fine", t("filum.digitalizza.fine")],
                          ...(detailOf(settings) ? [] : [["custom", t("filum.digitalizza.custom")] as ["custom", string]]),
                        ]}
                      />
                    </Row>
                    <Row label={t("filum.digitalizza.background")} title={t("filum.digitalizza.the_background_colour_left_out")}>
                      <Seg<Backdrop>
                        full
                        value={backdropOf(settings)}
                        onChange={(v) => set(backdropPatch(v))}
                        options={[
                          ["fabric", t("filum.digitalizza.left_out_2")],
                          ["enclosed", t("filum.digitalizza.enclosed")],
                          ["all", t("filum.digitalizza.stitched")],
                        ]}
                      />
                    </Row>
                    <Row label={t("filum.digitalizza.border")} title={t("filum.digitalizza.an_outline_around_the_whole")}>
                      <Seg
                        full
                        value={settings.outline}
                        onChange={(v) => set({ outline: v })}
                        options={[
                          ["none", t("filum.digitalizza.none")],
                          ["running", t("filum.digitalizza.running")],
                          ["satin", t("filum.digitalizza.satin")],
                        ]}
                      />
                    </Row>
                    {settings.outline === "satin" && (
                      <Row label={t("filum.digitalizza.border_width")}>
                        <Slider min={0.8} max={6} step={0.1} unit="mm" value={settings.outlineWidthMm} onChange={(v) => set({ outlineWidthMm: v })} />
                      </Row>
                    )}
                  </Group>
                )}
                {output === "shapes" && settings.photoZigzag && (
                  <Group title={t("filum.digitalizza.zig_zag_photo")}>
                    <Row label={t("filum.digitalizza.row_spacing")} title={t("filum.digitalizza.distance_between_the_rows_wider")}>
                      <Slider min={0.5} max={3} step={0.1} unit="mm" value={settings.photoSpacing} onChange={(v) => set({ photoSpacing: v })} />
                    </Row>
                    <Row label={t("filum.digitalizza.angle")} title={t("filum.digitalizza.direction_of_the_rows")}>
                      <Slider min={-90} max={90} step={5} digits={0} unit="°" value={settings.photoAngle} onChange={(v) => set({ photoAngle: v })} />
                    </Row>
                    <Row label={t("filum.digitalizza.contrast")} title={t("filum.digitalizza.higher_darker_darks_lighter_lights")}>
                      <Slider min={0.5} max={3} step={0.1} value={settings.photoContrast} onChange={(v) => set({ photoContrast: v })} />
                    </Row>
                    <Row label={t("filum.digitalizza.leave_light")} title={t("filum.digitalizza.parts_lighter_than_this_stay")}>
                      <Slider min={0} max={60} step={1} digits={0} unit="%" value={Math.round(settings.photoMin * 100)} onChange={(v) => set({ photoMin: v / 100 })} />
                    </Row>
                  </Group>
                )}
                <Group
                  title={t("filum.digitalizza.size")}
                  extra={
                    preview && (
                      <span className={`badge ${tooBig ? "warn" : ""}`} title={tooBig ? t("filum.digitalizza.larger_than_the_name_hoop", { name: doc.hoop.name }) : t("filum.digitalizza.fits_the_name_hoop", { name: doc.hoop.name })}>
                        {tooBig ? t("filum.digitalizza.larger_than_hoop") : t("filum.digitalizza.fits_hoop")}
                      </span>
                    )
                  }
                >
                  <div className="dz-size">
                    <label>
                      <span>W</span>
                      <Num value={widthMm} unit="mm" step={5} min={10} max={1000} digits={1} onChange={setWidthMm} />
                    </label>
                    <label>
                      <span>H</span>
                      <Num value={heightMm} unit="mm" step={5} min={10} max={1000} digits={1} onChange={(v) => setWidthMm(v / Math.max(aspect, 1e-6))} />
                    </label>
                    <button className="btn sm" onClick={fitHoop} disabled={!preview} title={t("filum.digitalizza.scale_to_90_of_the", { name: doc.hoop.name })}>
                      <Maximize2 size={12} />{t("filum.digitalizza.fit_hoop")}
                    </button>
                  </div>
                </Group>
              </>
            )}

            {pane === "colours" && (
              <>
                <Group title={t("filum.digitalizza.palette")}>
                  <Row label={t("filum.digitalizza.colours")}>
                    {fixedColors.length ? (
                      <span className="badge" title={t("filum.digitalizza.the_palette_is_locked_regions")}>
                        <Lock size={11} />{t("filum.digitalizza.locked")}{fixedColors.length}
                      </span>
                    ) : (
                      <Slider min={2} max={16} step={1} digits={0} value={settings.colors} onChange={(v) => set({ colors: v })} />
                    )}
                  </Row>
                  <Row label={t("filum.digitalizza.merge_similar")} title={t("filum.digitalizza.merge_colours_closer_than_this")}>
                    <Slider min={0} max={12} step={0.5} digits={1} unit={t("filum.digitalizza.e")} value={settings.mergeDeltaE} onChange={(v) => set({ mergeDeltaE: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.thread_chart")} title={t("filum.digitalizza.snap_colours_to_real_threads")}>
                    <ChartSelect value={chart} onChange={setChart} none={t("filum.digitalizza.exact_colours")} />
                  </Row>
                </Group>
                <Group
                  title={t("filum.digitalizza.background_left_out_areas")}
                  hint={
                    settings.backgroundScope === "outside"
                      ? t("filum.digitalizza.the_border_colour_is_left")
                      : settings.backgroundScope === "border"
                        ? t("filum.digitalizza.the_border_colour_is_left_2")
                        : t("filum.digitalizza.the_border_colour_is_left_3")
                  }
                >
                  <Row label={t("filum.digitalizza.background")} title={t("filum.digitalizza.leave_out_the_colour_that")}>
                    <Toggle on={settings.removeBackground} onChange={(v) => set({ removeBackground: v })} />
                  </Row>
                  {/* the three choices need the panel's full width */}
                  <Seg
                    full
                    disabled={!settings.removeBackground}
                    value={settings.backgroundScope}
                    onChange={(v) => set({ backgroundScope: v })}
                    options={[
                      ["border", t("filum.digitalizza.at_the_edge")],
                      ["outside", t("filum.digitalizza.outside_holes")],
                      ["everywhere", t("filum.digitalizza.everywhere")],
                    ]}
                  />
                  <div className="dz-removed">
                    <span>
                      <b>{(removedShare * 100).toFixed(removedShare < 0.1 ? 1 : 0)}%</b>{t("filum.digitalizza.of_the_picture_left_out")}
                      {regionEdits.length > 0 && <span className="stat">{tn("filum.digitalizza.areas_edited", regionEdits.length)}</span>}
                    </span>
                    <div className="dz-inline">
                      <button className={`btn sm ${tab === "colours" ? "primary" : ""}`} disabled={!preview} onClick={() => setTab("colours")} title={t("filum.digitalizza.show_what_is_left_out")}>
                        <Eye size={12} />{t("filum.digitalizza.review")}
                      </button>
                      {regionEdits.length > 0 && (
                        <button className="btn sm ghost" onClick={() => setRegionEdits([])} title={t("filum.digitalizza.forget_the_areas_you_clicked")}>
                          {t("filum.digitalizza.clear")}
                        </button>
                      )}
                    </div>
                  </div>
                </Group>
                <Group
                  title={`${t("filum.digitalizza.colours")}${colors.length ? t("filum.digitalizza.colours_stitched", { n: colors.filter((c) => !c.background).length }) : ""}`}
                  extra={
                    <span className="dz-head-actions">
                      <button className="icon-btn" title={fixedColors.length ? t("filum.digitalizza.unlock_palette_re_quantise") : t("filum.digitalizza.lock_this_palette")} onClick={fixedColors.length ? () => (setFixedColors([]), setOverrides({})) : lockPalette} disabled={!colors.length}>
                        {fixedColors.length ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                      <button className="icon-btn" title={t("filum.digitalizza.reset_colour_edits")} onClick={resetColours}>
                        <RotateCcw size={13} />
                      </button>
                    </span>
                  }
                >
                  <div className="dz-pick">
                    <span className="dz-pick-label">
                      <Pipette size={12} />{t("filum.digitalizza.pick_on_picture")}
                    </span>
                    <div className="seg" role="group" aria-label={t("filum.digitalizza.pick_a_colour_on_the")}>
                      {ROLES.filter((r) => r.id !== "auto").map((r) => (
                        <button
                          key={r.id}
                          className={pickRole === r.id ? "on" : ""}
                          disabled={!img}
                          title={t("filum.digitalizza.click_colours_in_the_picture", { v1: r.label.toLowerCase() })}
                          onClick={() => {
                            const next = pickRole === r.id ? null : (r.id as Exclude<Role, "auto">);
                            setPickRole(next);
                            if (next && tab !== "original" && tab !== "colours") setTab("original");
                          }}
                        >
                          {r.icon} {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dz-colours">
                    {colors.map((c, i) => (
                      <div key={i} className={`dz-colour ${c.background ? "off" : ""}`}>
                        <input type="color" value={overrides[c.hex] ?? c.hex} onChange={(e) => editColour(i, e.target.value)} title={t("filum.digitalizza.choose_the_thread_colour_for")} />
                        <span className="dz-cname" title={c.code ? `${c.name} ${c.code}` : c.name}>
                          {overrides[c.hex] ? overrides[c.hex].toUpperCase() : c.name}
                          {c.code && <span className="stat"> {c.code}</span>}
                          {c.background && c.coverage - (c.removed ?? 0) > 0.0005 && <span className="stat">{t("filum.digitalizza.partly_stitched")}</span>}
                          {roleOf(c) === "auto" && (c.lines ?? 0) > 0.5 * Math.max(1e-9, c.coverage - (c.removed ?? 0)) && <span className="dz-auto">{t("filum.digitalizza.lines_2")}</span>}
                        </span>
                        <span
                          className="dz-cover"
                          title={`${t("filum.digitalizza.picture_stitched", { pct: ((c.coverage - (c.removed ?? 0)) * 100).toFixed(1) })}${c.removed ? t("filum.digitalizza.picture_left_out", { pct: (c.removed * 100).toFixed(1) }) : ""}`}
                        >
                          <i style={{ width: `${Math.min(100, c.coverage * 100)}%` }} className="all" />
                          <i style={{ width: `${Math.min(100, Math.max(0, c.coverage - (c.removed ?? 0)) * 100)}%` }} />
                          <b>{(c.coverage * 100).toFixed(c.coverage < 0.1 ? 1 : 0)}%</b>
                        </span>
                        <div className="dz-role" role="group" aria-label={t("filum.digitalizza.name_sew_as", { name: c.name })}>
                          {ROLES.map((r) => (
                            <button key={r.id} className={roleOf(c) === r.id ? "on" : ""} title={`${r.label} — ${r.hint}`} onClick={() => setRole(c, r.id)}>
                              {r.icon}
                            </button>
                          ))}
                        </div>
                        <div className="dz-role" role="group">
                          <button
                            className={hasEdge(c) ? "on" : ""}
                            disabled={c.background}
                            aria-pressed={hasEdge(c)}
                            aria-label={t("filum.digitalizza.name_satin_edge", { name: c.name })}
                            title={t("filum.digitalizza.satin_edge_a_satin_in")}
                            onClick={() => toggleEdge(c)}
                          >
                            <StitchSatin size={12} />
                          </button>
                        </div>
                        {fixedColors.length > 2 ? (
                          <button className="mini" onClick={() => removeColour(i)} title={t("filum.digitalizza.merge_into_the_nearest_remaining")}>
                            ×
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    {!colors.length && <div className="hint">{t("filum.digitalizza.colours_appear_here_after_loading")}</div>}
                  </div>
                </Group>
                {output === "shapes" && (result?.threads.length ?? 0) > 1 && (
                  <Group
                    title={t("filum.digitalizza.sew_order")}
                    hint={t("filum.digitalizza.first_sewn_first_a_later")}
                    extra={
                      colorOrder.length ? (
                        <button className="btn sm ghost" onClick={() => setColorOrder([])} title={t("filum.digitalizza.back_to_the_digitizer_s")}>
                          <RotateCcw size={12} />{t("filum.digitalizza.auto_2")}
                        </button>
                      ) : undefined
                    }
                  >
                    <ol className="dz-order" aria-label={t("filum.digitalizza.sew_order")}>
                      {(recoloured ?? result)!.threads.map((th, i, all) => (
                        <li key={th.id}>
                          <span className="dz-order-n">{i + 1}</span>
                          <i className="dz-order-sw" style={{ background: th.color }} />
                          <span className="dz-cname" title={th.name}>
                            {th.name}
                          </span>
                          <button className="mini" disabled={i === 0} onClick={() => moveThread(i, -1)} aria-label={t("filum.digitalizza.sew_name_earlier", { name: th.name })} title={t("filum.digitalizza.sew_earlier_underneath")}>
                            ↑
                          </button>
                          <button className="mini" disabled={i === all.length - 1} onClick={() => moveThread(i, 1)} aria-label={t("filum.digitalizza.sew_name_later", { name: th.name })} title={t("filum.digitalizza.sew_later_on_top")}>
                            ↓
                          </button>
                        </li>
                      ))}
                    </ol>
                  </Group>
                )}
              </>
            )}

            {pane === "shapes" && (
              <>
                <Group title={t("filum.digitalizza.picture")}>
                  <Row label={t("filum.digitalizza.resolution")} title={t("filum.digitalizza.working_resolution_more_is_slower")}>
                    <Slider min={200} max={1600} step={20} digits={0} unit={t("filum.digitalizza.px")} value={settings.maxPixels} onChange={(v) => set({ maxPixels: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.denoise")} title={t("filum.digitalizza.edge_preserving_smoothing_before_colours")}>
                    <Slider min={0} max={4} step={1} digits={0} value={settings.denoise} onChange={(v) => set({ denoise: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.pixel_art")} title={t("filum.digitalizza.depixelize_sprites_and_icons_into")}>
                    <Seg value={settings.pixelArt} onChange={(v) => set({ pixelArt: v })} options={[["auto", t("filum.digitalizza.auto")], ["on", t("filum.digitalizza.on")], ["off", t("filum.digitalizza.off")]]} />
                  </Row>
                </Group>
                <Group title={t("filum.digitalizza.tracing")}>
                  <Row label={t("filum.digitalizza.seamless")} title={t("filum.digitalizza.neighbouring_shapes_share_one_traced")}>
                    <Toggle on={settings.seamless} onChange={(v) => set({ seamless: v })} />
                  </Row>
                  {settings.seamless && (
                    <Row label={t("filum.digitalizza.corners_over")} title={t("filum.digitalizza.boundary_turns_sharper_than_this")}>
                      <Slider min={20} max={120} step={5} digits={0} unit="°" value={settings.cornerAngle} onChange={(v) => set({ cornerAngle: v })} />
                    </Row>
                  )}
                  <Row label={t("filum.digitalizza.gradients")} title={t("filum.digitalizza.smooth_colour_ramps_become_dithered")}>
                    <Toggle on={settings.gradients} onChange={(v) => set({ gradients: v })} />
                  </Row>
                  {settings.gradients && (
                    <Row label={t("filum.digitalizza.gradient_rows")} title={t("filum.digitalizza.straight_rows_or_streamlines_that")}>
                      <Seg
                        value={settings.gradientFlow ? "flow" : "straight"}
                        onChange={(v) => set({ gradientFlow: v === "flow" })}
                        options={[
                          ["straight", t("filum.digitalizza.straight")],
                          ["flow", t("filum.digitalizza.flow")],
                        ]}
                      />
                    </Row>
                  )}
                </Group>
                <Group title={t("filum.digitalizza.cleanup")}>
                  <Row label={t("filum.digitalizza.smoothing")} title={t("filum.digitalizza.majority_filter_passes_that_remove")}>
                    <Slider min={0} max={6} step={1} digits={0} value={settings.smoothing} onChange={(v) => set({ smoothing: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.min_region")} title={t("filum.digitalizza.smaller_specks_merge_into_their")}>
                    <Slider min={0} max={10} step={0.25} unit={t("filum.digitalizza.mm2")} value={settings.minRegionMm2} onChange={(v) => set({ minRegionMm2: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.simplify")} title={t("filum.digitalizza.contour_simplification_tolerance")}>
                    <Slider min={0.02} max={0.5} step={0.01} unit="mm" value={settings.simplifyMm} onChange={(v) => set({ simplifyMm: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.overlap")} title={t("filum.digitalizza.grow_fills_so_neighbouring_colours")}>
                    <Slider min={0} max={0.8} step={0.05} unit="mm" value={settings.overlapMm} onChange={(v) => set({ overlapMm: v })} />
                  </Row>
                </Group>
              </>
            )}

            {pane === "lines" && (
              <>
                <Group
                  title={t("filum.digitalizza.lines_in_the_picture")}
                  hint={t("filum.digitalizza.outlines_ink_strokes_and_narrow")}
                  extra={<Toggle on={settings.lineNetworks} onChange={(v) => set({ lineNetworks: v })} />}
                >
                  {settings.lineNetworks && (
                    <>
                      <Row label={t("filum.digitalizza.ink_lines")} title={t("filum.digitalizza.dark_lines_found_on_the")}>
                        <Slider min={0} max={100} step={5} digits={0} unit="%" value={settings.inkSensitivity} onChange={(v) => set({ inkSensitivity: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.max_width")} title={t("filum.digitalizza.lines_up_to_this_width")}>
                        <Slider min={0.5} max={8} step={0.1} digits={1} unit="mm" value={settings.lineMaxWidthMm} onChange={(v) => set({ lineMaxWidthMm: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.bridge_gaps")} title={t("filum.digitalizza.join_line_ends_that_point")}>
                        <Slider min={0} max={4} step={0.1} digits={1} unit="mm" value={settings.lineGapMm} onChange={(v) => set({ lineGapMm: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.min_length")} title={t("filum.digitalizza.shorter_lines_and_side_branches")}>
                        <Slider min={0.5} max={10} step={0.5} digits={1} unit="mm" value={settings.lineMinMm} onChange={(v) => set({ lineMinMm: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.through_junctions")} title={t("filum.digitalizza.a_line_continues_through_a")}>
                        <Slider min={0} max={60} step={5} digits={0} unit="°" value={settings.lineContinuity} onChange={(v) => set({ lineContinuity: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.outline_width")} title={t("filum.digitalizza.dark_lines_outlines_ink_as")}>
                        <span className="dz-inline">
                          <Toggle on={settings.outlineLineMm > 0} onChange={(v) => set({ outlineLineMm: v ? OUTLINE_DEFAULT_MM : 0 })} />
                          {settings.outlineLineMm > 0 && <Num value={settings.outlineLineMm} unit="mm" step={0.1} min={0.5} max={4} digits={1} onChange={(v) => set({ outlineLineMm: v })} />}
                        </span>
                      </Row>
                      {settings.outlineLineMm <= 0 && (
                        <Row label={t("filum.digitalizza.follow_width")} title={t("filum.digitalizza.satin_lines_get_wider_and")}>
                          <Toggle on={settings.lineTaper} onChange={(v) => set({ lineTaper: v })} />
                        </Row>
                      )}
                      <Row label={t("filum.digitalizza.one_network")} title={t("filum.digitalizza.lines_that_meet_are_sewn")}>
                        <Toggle on={settings.routeLines} onChange={(v) => set({ routeLines: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.sub_pixel")} title={t("filum.digitalizza.line_centres_follow_the_drawn")}>
                        <Toggle on={settings.lineSubpixel} onChange={(v) => set({ lineSubpixel: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.thin_lines")} title={t("filum.digitalizza.lines_narrower_than_the_hairline")}>
                        <Seg
                          value={settings.thinTriple ? "triple" : "running"}
                          onChange={(v) => set({ thinTriple: v === "triple" })}
                          options={[
                            ["running", t("filum.digitalizza.running")],
                            ["triple", t("filum.digitalizza.triple")],
                          ]}
                        />
                      </Row>
                    </>
                  )}
                </Group>
                <Group title={t("filum.digitalizza.stitch_types")} hint={t("filum.digitalizza.lines_narrower_than_the_hairline_2")}>
                  <Row label={t("filum.digitalizza.satin_strokes")} title={t("filum.digitalizza.narrow_elongated_regions_become_satin")}>
                    <span className="dz-inline">
                      <Toggle on={settings.allowSatin} onChange={(v) => set({ allowSatin: v })} />
                      {settings.allowSatin && (
                        <>
                          <span className="stat">{t("filum.digitalizza.up_to")}</span>
                          <Num value={settings.satinMaxWidthMm} unit="mm" step={0.5} min={1} max={12} onChange={(v) => set({ satinMaxWidthMm: v })} />
                        </>
                      )}
                    </span>
                  </Row>
                  <Row label={t("filum.digitalizza.hairlines")} title={t("filum.digitalizza.very_thin_lines_become_running")}>
                    <span className="dz-inline">
                      <Toggle on={settings.allowRunning} onChange={(v) => set({ allowRunning: v })} />
                      {settings.allowRunning && (
                        <>
                          <span className="stat">{t("filum.digitalizza.up_to")}</span>
                          <Num value={settings.runningMaxWidthMm} unit="mm" step={0.1} min={0.2} max={3} onChange={(v) => set({ runningMaxWidthMm: v })} />
                        </>
                      )}
                    </span>
                  </Row>
                </Group>
                <Group title={t("filum.digitalizza.extra_lines")} hint={EXTRA().find((x) => x[0] === extra)?.[3]}>
                  <div className="dz-sources" role="radiogroup" aria-label={t("filum.digitalizza.extra_lines")}>
                    {EXTRA().map(([id, icon, label, hint]) => (
                      <button key={id} role="radio" aria-checked={extra === id} className={extra === id ? "on" : ""} title={hint} onClick={() => chooseExtra(id)}>
                        {icon}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  {extra === "colour" && (
                    <>
                      {!settings.seamless && <p className="dz-hint warn">{t("filum.digitalizza.colour_edges_need_seamless_tracing")}</p>}
                      <Row label={t("filum.digitalizza.contrast")} title={t("filum.digitalizza.only_edges_between_colours_at")}>
                        <Slider min={5} max={80} step={1} digits={0} unit={t("filum.digitalizza.e")} value={settings.edgeContrast} onChange={(v) => set({ edgeContrast: v })} />
                      </Row>
                      <Row label={t("filum.digitalizza.stitch")}>
                        <Seg
                          value={settings.edgeOutlines === "satin" ? "satin" : "running"}
                          onChange={(v) => set({ edgeOutlines: v })}
                          options={[
                            ["running", t("filum.digitalizza.running")],
                            ["satin", t("filum.digitalizza.satin")],
                          ]}
                        />
                      </Row>
                      {settings.edgeOutlines === "satin" && (
                        <Row label={t("filum.digitalizza.width")} title={t("filum.digitalizza.satin_width_the_border_uses")}>
                          <Slider min={0.8} max={6} step={0.1} unit="mm" value={settings.outlineWidthMm} onChange={(v) => set({ outlineWidthMm: v })} />
                        </Row>
                      )}
                      {outlineColourRow}
                    </>
                  )}
                  {extra !== "none" && extra !== "colour" && (
                    <Row label={t("filum.digitalizza.amount")} title={t("filum.digitalizza.more_lines_and_fainter_ones")}>
                      <Slider min={0} max={1} step={0.05} value={settings.lineStrength} onChange={(v) => set({ lineStrength: v })} />
                    </Row>
                  )}
                  {extra !== "none" && <p className="dz-hint">{t("filum.digitalizza.one_line_per_place_the")}</p>}
                </Group>
              </>
            )}

            {pane === "cross" && (
              <>
                <Group title={t("filum.digitalizza.cells")} hint={t("filum.digitalizza.one_cross_per_cell_the")}>
                  <Row label={t("filum.digitalizza.cell")} title={t("filum.digitalizza.size_of_one_cross_ink")}>
                    <span className="dz-inline">
                      <Num value={cross.cell} step={0.1} min={0.8} max={12} unit="mm" onChange={(v) => setCross({ cell: v })} />
                      {!cross.square && <Num value={cross.cellY} step={0.1} min={0.8} max={12} unit="mm" onChange={(v) => setCross({ cellY: v })} />}
                      <Toggle on={cross.square} onChange={(v) => setCross({ square: v, cellY: cross.cell })} title={t("filum.digitalizza.square_cells")} />
                    </span>
                  </Row>
                  <Row label={t("filum.digitalizza.coverage")} title={t("filum.digitalizza.how_much_of_a_cell")}>
                    <Slider min={10} max={100} step={5} digits={0} unit="%" value={Math.round(cross.coverage * 100)} onChange={(v) => setCross({ coverage: v / 100 })} />
                  </Row>
                  {crossed && (
                    <p className="dz-hint">
                      {crossed.cols} × {crossed.rows}{t("filum.digitalizza.cells_2")}<b>{crossed.crosses.toLocaleString()}</b>{tn("filum.digitalizza.crosses_in_colours", crossed.threads.length)}
                    </p>
                  )}
                </Group>
                <Group title={t("filum.digitalizza.stitches")} hint={CROSS_KINDS().find((k) => k[0] === cross.kind)?.[2]}>
                  <div className="seg seg-full">
                    {CROSS_KINDS().map(([k, l, t]) => (
                      <button key={k} title={t} className={cross.kind === k ? "on" : ""} onClick={() => setCross({ kind: k })}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <Row label={t("filum.digitalizza.grid_on_the_cells")} title={t("filum.digitalizza.after_adding_show_the_canvas")}>
                    <Toggle on={cross.grid} onChange={(v) => setCross({ grid: v })} />
                  </Row>
                </Group>
              </>
            )}

            {pane === "stitches" && (
              <>
                <Group title={t("filum.digitalizza.fill")} hint={FILL_METHODS.find((m) => m.id === settings.fillMethod)?.hint}>
                  <div className="dz-methods">
                    {FILL_METHODS.map((m) => (
                      <button
                        key={m.id}
                        className={settings.fillMethod === m.id ? "on" : ""}
                        title={m.hint}
                        onClick={() => {
                          const d = fillMethodDefaults(m.id);
                          set({ fillMethod: d.method!, rowSpacing: d.rowSpacing ?? settings.rowSpacing, underlay: d.underlay ?? settings.underlay });
                        }}
                      >
                        <m.icon size={15} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <Row label={t("filum.digitalizza.density")} title={t("filum.digitalizza.row_spacing_smaller_is_denser")}>
                    <Slider min={0.15} max={settings.fillMethod === "hilbert" || settings.fillMethod === "stipple" || settings.fillMethod === "meander" ? 3 : 1} step={0.01} unit="mm" value={settings.rowSpacing} onChange={(v) => set({ rowSpacing: v })} />
                  </Row>
                  <Row label={t("filum.digitalizza.underlay")} title={t("filum.digitalizza.a_light_foundation_layer_under")}>
                    <Toggle on={settings.underlay} onChange={(v) => set({ underlay: v })} />
                  </Row>
                </Group>
                {settings.fillMethod === "flow" && (
                  <Group title={t("filum.digitalizza.flow")} hint={t("filum.digitalizza.lower_strength_straightens_the_rows")}>
                    <Row label={t("filum.digitalizza.strength")} title={t("filum.digitalizza.how_much_rows_follow_the")}>
                      <Slider min={0} max={100} step={5} digits={0} unit="%" value={Math.round(settings.flowStrength * 100)} onChange={(v) => set({ flowStrength: v / 100 })} />
                    </Row>
                    <Row label={t("filum.digitalizza.detail")} title={t("filum.digitalizza.field_cells_across_each_shape")}>
                      <Slider min={8} max={100} step={2} digits={0} value={settings.flowDetail} onChange={(v) => set({ flowDetail: v })} />
                    </Row>
                    <Row label={t("filum.digitalizza.smoothing")} title={t("filum.digitalizza.smoothing_passes_of_the_picture")}>
                      <Slider min={1} max={8} step={1} digits={0} value={settings.flowSmoothing} onChange={(v) => set({ flowSmoothing: v })} />
                    </Row>
                  </Group>
                )}
                {DIRECTED.includes(settings.fillMethod) && (
                  <Group
                    title={settings.fillMethod === "flow" ? t("filum.digitalizza.base_direction") : t("filum.digitalizza.direction")}
                    hint={settings.fillMethod === "flow" ? t("filum.digitalizza.where_the_picture_has_no") : DIRECTIONS().find((d) => d[0] === direction)?.[2]}
                  >
                    <Seg
                      full
                      value={direction}
                      onChange={(v) => (v === "fixed" ? set({ fillAngle: settings.fillAngle ?? 45 }) : set({ fillAngle: null, fillDirection: v }))}
                      options={DIRECTIONS().map(([id, label]) => [id, label])}
                    />
                    {direction === "fixed" && (
                      <Row label={t("filum.digitalizza.angle")}>
                        <Slider min={-90} max={90} step={5} digits={0} unit="°" value={settings.fillAngle ?? 45} onChange={(v) => set({ fillAngle: v })} />
                      </Row>
                    )}
                  </Group>
                )}
              </>
            )}

            {pane === "ai" && (
              <>
                <p className="dz-hint">
                  <span className="badge">{t("filum.digitalizza.on_device")}</span>{t("filum.digitalizza.the_models_are_bundled_with")}
                </p>
                <Group title={t("filum.digitalizza.objects")} hint={t("filum.digitalizza.mobilesam_click_an_object_in")}>
                  <button className={`btn sm ${samMode ? "primary" : ""}`} style={{ width: "100%" }} disabled={!bmp} onClick={() => (samMode ? setSamMode(false) : startSam())}>
                    <MousePointerClick size={13} /> {samMode ? t("filum.digitalizza.done_selecting") : t("filum.digitalizza.select_objects")}
                  </button>
                  {samMode && (
                    <>
                      <p className="dz-hint">{t("filum.digitalizza.click_to_add_alt_or")}</p>
                      <div className="dz-mask-actions">
                        {MASK_MODES().map(([mode, label, hint]) => (
                          <button key={mode} className={`btn sm ${mode}`} disabled={!curMask} onClick={() => useMask(mode)} title={hint}>
                            {label}
                          </button>
                        ))}
                        <button className="btn sm ghost" disabled={!samPts.length} onClick={() => (setSamPts([]), setCurMask(null))}>
                          {t("filum.digitalizza.clear")}
                        </button>
                      </div>
                    </>
                  )}
                  {masks.length > 0 && (
                    <div className="dz-masks">
                      {masks.map((m, i) => (
                        <span key={i} className={`chip ${m.mode}`} title={MASK_MODES().find((x) => x[0] === m.mode)?.[2]}>
                          {MASK_MODES().find((x) => x[0] === m.mode)?.[1]} {i + 1}
                          <button className="mini" onClick={() => setMasks(masks.filter((_, k) => k !== i))} title={t("filum.digitalizza.delete")}>
                            <Trash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </Group>
                <Group title={t("filum.digitalizza.text")} hint={t("filum.digitalizza.tesseract_ticked_lines_are_erased")}>
                  <button className="btn sm" style={{ width: "100%" }} disabled={!img || !!busy} onClick={runOcr}>
                    <ScanText size={13} /> {textLines ? t("filum.digitalizza.find_text_again") : t("filum.digitalizza.find_text")}
                  </button>
                  {textLines && textLines.length > 0 && (
                    <div className="dz-text">
                      {textLines.map((l, i) => (
                        <label key={i} className="dz-textline" title={t("filum.digitalizza.v1_confident", { v1: Math.round(l.confidence) })}>
                          <input type="checkbox" checked={!!textPick[i]} onChange={(e) => setTextPick(textPick.map((v, k) => (k === i ? e.target.checked : v)))} />
                          <span>{l.text}</span>
                          <i className="stat">{Math.round(l.confidence)}%</i>
                        </label>
                      ))}
                    </div>
                  )}
                  {textLines && !textLines.length && <p className="dz-hint">{t("filum.digitalizza.no_text_found_2")}</p>}
                </Group>
              </>
            )}
          </div>

          <div className="dz-side-foot">
            <button className="btn sm ghost" disabled={!paneChanges(pane)} onClick={() => resetPane(pane)} title={t("filum.digitalizza.back_to_the_defaults_of")}>
              <RotateCcw size={12} />{t("filum.digitalizza.reset")}{PANES.find((p) => p.id === pane)?.label.toLowerCase()}
            </button>
            <div className="spacer" />
            <button className="btn sm ghost" onClick={() => setSettings(presetSettings("logo"))} title={t("filum.digitalizza.all_settings_back_to_the")}>
              {t("filum.digitalizza.reset_all")}
            </button>
          </div>
        </div>

        <div className="dz-main">
          <div className="dz-tabs">
            <div className="seg">
              {(
                [
                  ["original", t("filum.digitalizza.original")],
                  ["colours", t("filum.digitalizza.regions")],
                  ["vector", t("filum.digitalizza.shapes")],
                  ["stitches", t("filum.digitalizza.stitches")],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "stitches" && (
              <div className="seg">
                <button className={stitchLook === "realistic" ? "on" : ""} onClick={() => setStitchLook("realistic")}>
                  {t("filum.digitalizza.realistic")}
                </button>
                <button className={stitchLook === "stitch" ? "on" : ""} onClick={() => setStitchLook("stitch")}>
                  {t("filum.digitalizza.stitch")}
                </button>
              </div>
            )}
            <div className="spacer" />
            {busy && (
              <span className="stat" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="dot-pulse" /> {busy}
              </span>
            )}
          </div>
          <div ref={boxRef} className={`dz-box ${tab === "colours" ? "checker" : ""}`}>
            {pickRole && img && (tab === "original" || tab === "colours") && (
              <div className="dz-pickbar">
                <Pipette size={13} />{t("filum.digitalizza.click_colours_to_make_them")}<b>{ROLES.find((r) => r.id === pickRole)?.label.toLowerCase()}</b>
                <button className="btn sm" onClick={() => setPickRole(null)}>
                  {t("filum.digitalizza.done")}
                </button>
              </div>
            )}
            {!img ? (
              <button className="dz-empty" onClick={pick}>
                <ImageUp size={28} />
                <b>{t("filum.digitalizza.drop_paste_or_choose_an")}</b>
                <span>{t("filum.digitalizza.png_jpg_webp_bmp_or")}</span>
              </button>
            ) : error ? (
              <span className="hint" style={{ color: "var(--accent)" }}>
                {error}
              </span>
            ) : tab === "original" && samMode && bmp ? (
              <SamCanvas bmp={bmp} sam={sam} mask={curMask} pts={samPts} masks={masks} w={pw} h={ph} onPick={samClick} />
            ) : tab === "original" && wantMap && edgeKind === wantMap && edgeMap && !eyedropper ? (
              <PreviewCanvas
                draw={(ctx, dpr) => {
                  const t = document.createElement("canvas");
                  t.width = edgeMap.width;
                  t.height = edgeMap.height;
                  t.getContext("2d")!.putImageData(edgeMapImage(edgeMap), 0, 0);
                  const W = ctx.canvas.width;
                  const H = ctx.canvas.height;
                  const ar = bmp ? bmp.height / bmp.width : 0.75;
                  const k = Math.min((W - 24 * dpr) / 1, (H - 24 * dpr) / ar);
                  ctx.drawImage(t, (W - k) / 2, (H - k * ar) / 2, k, k * ar);
                }}
                w={pw}
                h={ph}
              />
            ) : tab === "original" ? (
              <img
                ref={imgRef}
                src={img.url}
                alt={img.name}
                onClick={onOriginalClick}
                style={{ cursor: eyedropper ? "crosshair" : "default", maxWidth: "100%", maxHeight: "100%" }}
              />
            ) : tab === "colours" ? (
              preview && <RegionEditor preview={preview} overrides={overrides} edits={regionEdits} w={pw} h={ph} onToggle={toggleRegion} />
            ) : tab === "stitches" ? (
              plan && previewDoc ? (
                <DesignView doc={previewDoc} plan={plan} mode={stitchLook} fabricColor={fabricColor} />
              ) : (
                !busy && <span className="hint">{t("filum.digitalizza.nothing_to_stitch_every_colour")}</span>
              )
            ) : (
              previewDoc && <DesignView doc={previewDoc} plan={plan} mode="vector" fabricColor={fabricColor} gridStep={output === "cross" ? cross.cell : undefined} />
            )}
          </div>
          {tab === "colours" && preview && (
            <div className="dz-legend">
              <span>
                <i className="hatch" />{t("filum.digitalizza.left_out")}
              </span>
              <span>
                <i className="keep" />{t("filum.digitalizza.you_stitched")}
              </span>
              <span>
                <i className="drop" />{t("filum.digitalizza.you_left_out")}
              </span>
              <span className="stat">{t("filum.digitalizza.click_an_area_to_flip")}</span>
            </div>
          )}
          <div className="dz-stats">
            {preview && removedShare > 0.002 && tab !== "colours" && (
              <button className="dz-notice" onClick={() => setTab("colours")} title={t("filum.digitalizza.show_what_is_left_out_2")}>
                <b>{(removedShare * 100).toFixed(0)}%</b>{t("filum.digitalizza.left_out_review")}
              </button>
            )}
            {result && (
              <>
                <span>
                  <b>{result.objects.length}</b>{t("filum.digitalizza.objects_2")}
                </span>
                <span className="stat">
                  {output === "cross" && crossed
                    ? t("filum.digitalizza.v1_crosses_cols_rows_cells", { v1: crossed.crosses.toLocaleString(), cols: crossed.cols, rows: crossed.rows })
                    : t("filum.digitalizza.fill_fills_satin_satins_running", { fill: counts.fill, satin: counts.satin, running: counts.running })}
                </span>
                <span>
                  <b>{result.threads.length}</b>{t("filum.digitalizza.threads")}
                </span>
              </>
            )}
            {stats && (
              <>
                <span>
                  <b>{stats.stitches.toLocaleString()}</b>{t("filum.digitalizza.stitches_2")}
                </span>
                <span>
                  <b>{fmtTime(stats.seconds)}</b>{t("filum.digitalizza.min")}
                </span>
              </>
            )}
            {preview && (
              <span className={tooBig ? "warn" : ""} title={tooBig ? t("filum.digitalizza.larger_than_the_name_hoop", { name: doc.hoop.name }) : undefined}>
                <b>
                  {widthMm.toFixed(0)} × {heightMm.toFixed(0)}
                </b>{" "}
                mm{tooBig ? " ⚠" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** The original picture with click-to-select objects (MobileSAM). */
function SamCanvas({
  bmp,
  sam,
  mask,
  pts,
  masks,
  w,
  h,
  onPick,
}: {
  bmp: ImageBitmap;
  sam: SamImage | null;
  mask: Uint8Array | null;
  pts: SamPoint[];
  masks: { mode: string; px: Uint8Array; w: number; h: number }[];
  w: number;
  h: number;
  onPick: (p: SamPoint) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    drawSam(c.getContext("2d")!, dpr, bmp, sam, mask, pts, masks);
  }, [bmp, sam, mask, pts, masks, w, h]);
  const click = (e: React.MouseEvent<HTMLCanvasElement>, negative: boolean) => {
    if (!sam || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const k = Math.min((r.width - 24) / bmp.width, (r.height - 24) / bmp.height);
    const x0 = (r.width - bmp.width * k) / 2;
    const y0 = (r.height - bmp.height * k) / 2;
    const ix = (e.clientX - r.left - x0) / k;
    const iy = (e.clientY - r.top - y0) / k;
    if (ix < 0 || iy < 0 || ix > bmp.width || iy > bmp.height) return;
    onPick({ x: (ix / bmp.width) * sam.w, y: (iy / bmp.height) * sam.h, label: negative || e.altKey ? 0 : 1 });
  };
  return (
    <canvas
      ref={ref}
      style={{ width: w, height: h, cursor: sam ? "crosshair" : "progress" }}
      onClick={(e) => click(e, false)}
      onContextMenu={(e) => {
        e.preventDefault();
        click(e, true);
      }}
    />
  );
}
