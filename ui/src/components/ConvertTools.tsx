// Shape conversions (Path menu · context bar "Convert"): fill → satin,
// fill → centre line, satin → centre line, centre line → rails, zig-zag line
// → satin, patterned satin, break apart, remove duplicated points. One live
// dialog in the style of Shape effects: pick a conversion, tune it while the
// result previews on the canvas, Apply commits one undo step.

import { ArrowRightLeft, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { DesignObject, SubPath, Vec2 } from "../types";
import { flattenSubPath } from "../lib/bezier";
import { patternSatin, SATIN_PATTERNS, type SatinPattern, type ZigzagPattern } from "../lib/convert";
import { applies, applyPlan, DEFAULT_CONVERT, planConversion, UNDERLAYS, type ConvertId, type ConvertOptions, type ConvertPlan } from "../lib/convertActions";
import { Dialog, Num, Row, Slider, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t, withTexts } from "../nova/i18n/filum";

const KEY = "filum.convert";
let pending: ConvertId | null = null;

/** Open the Convert dialog on one conversion. */
export function openConvert(id: ConvertId) {
  pending = id;
  useStore.getState().setDialog("convert");
}


type Icon = { d: string; fill?: boolean; thin?: boolean }[];

// NOVAstitch (modulo i): label, menu e title vengono dal catalogo (filum.finestre.converti.<id>.…)
export const CONVERSIONS: { id: ConvertId; label: string; menu: string; title: string; icon: Icon }[] = (
  [
  {
    id: "fillToSatin",
    icon: [{ d: "M5 9 C9 3 23 3 27 9 L27 23 C23 29 9 29 5 23 Z", fill: true }, { d: "M2 12 L30 12 M2 20 L30 20", thin: true }],
  },
  {
    id: "fillToStroke",
    icon: [{ d: "M4 22 C6 8 12 6 16 6 C22 6 28 12 28 18 L22 20 C21 15 19 12 16 12 C13 12 10 16 10 24 Z", fill: true }, { d: "M7 23 C8 13 12 9 16 9 C21 9 24 14 25 19", thin: true }],
  },
  {
    id: "satinToStroke",
    icon: [{ d: "M4 20 C10 8 22 8 28 20 L24 23 C20 14 12 14 8 23 Z", fill: true }, { d: "M6 21.5 C11 11 21 11 26 21.5", thin: true }],
  },
  {
    id: "satinToRails",
    icon: [{ d: "M4 20 C10 8 22 8 28 20 M8 23 C12 14 20 14 24 23 M7 15 L10 19 M16 9 L16 15 M25 15 L22 19", thin: true }],
  },
  {
    id: "zigzagToSatin",
    icon: [{ d: "M4 22 L4 10 L10 10 L10 22 L16 22 L16 10 L22 10 L22 22 L28 22 L28 10", thin: true }],
  },
  {
    id: "patternSatin",
    icon: [{ d: "M3 16 L8 11 L13 16 L8 21 Z M13 16 L18 11 L23 16 L18 21 Z M23 16 L28 11 L33 16 L28 21 Z", fill: true }],
  },
  {
    id: "breakApart",
    icon: [{ d: "M4 6 L14 6 L14 16 L4 16 Z M18 16 L28 16 L28 26 L18 26 Z", fill: true }, { d: "M14 6 L28 26", thin: true }],
  },
  {
    id: "dedupe",
    icon: [{ d: "M4 24 L12 8 L20 20 L28 6", thin: true }, { d: "M10.5 6.5 h3 v3 h-3 Z M18.5 18.5 h3 v3 h-3 Z", fill: true }],
  },
  {
    id: "connectLines",
    icon: [{ d: "M4 22 L11 10", thin: true }, { d: "M13 9 L20 21", thin: true }, { d: "M22 21 L28 9", thin: true }, { d: "M4 26 L11 14 L20 25 L28 13" }],
  },
  ] as { id: ConvertId; icon: Icon }[]
).map((c) => withTexts("filum.finestre.converti", ["label", "menu", "title"], c));

function loadOptions(): ConvertOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const out = { ...DEFAULT_CONVERT } as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_CONVERT)) out[k] = { ...(DEFAULT_CONVERT as unknown as Record<string, object>)[k], ...(raw[k] ?? {}) };
    return out as unknown as ConvertOptions;
  } catch {
    return DEFAULT_CONVERT;
  }
}

function IconSvg({ icon, size = 52 }: { icon: Icon; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" style={{ width: size, height: size }}>
      {icon.map((p, i) => (
        <path key={i} d={p.d} style={p.thin ? { fill: "none" } : p.fill ? undefined : { fill: "none" }} />
      ))}
    </svg>
  );
}

const outlineOf = (paths: SubPath[]) => {
  // a satin's rails as one closed outline for a thumbnail
  if (paths.length < 2) return "";
  const a = flattenSubPath(paths[0], 0.3);
  const b = flattenSubPath(paths[1], 0.3).reverse();
  return [...a, ...b].map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("") + "Z";
};
const polyline = (pts: Vec2[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("");

const ZIGZAGS: { id: ZigzagPattern; label: string; pts: Vec2[]; title: string }[] = [
  { id: "square", get label() { return t("filum.finestre.square"); }, get title() { return t("filum.finestre.____four_points_per"); }, pts: [[3, 22], [3, 10], [9, 10], [9, 22], [15, 22], [15, 10], [21, 10], [21, 22], [27, 22], [27, 10]] },
  { id: "sawtooth", get label() { return t("filum.finestre.sawtooth"); }, get title() { return t("filum.finestre.every_point_on_the_other"); }, pts: [[3, 22], [6, 10], [10, 22], [13, 10], [17, 22], [20, 10], [24, 22], [27, 10]] },
  { id: "zigzag", label: "Zig-zag", get title() { return t("filum.finestre.vvv_the_stitches_follow_the"); }, pts: [[3, 22], [7, 10], [11, 22], [15, 10], [19, 22], [23, 10], [27, 22]] },
];

export function ConvertDialog({ onClose }: { onClose: () => void }) {
  // the document and selection as they were when the dialog opened
  const base = useMemo(() => {
    const d = useStore.getState().doc;
    return { objects: d.objects, groupParents: d.groupParents, groupNames: d.groupNames };
  }, []);
  const sel = useMemo(() => {
    const s = useStore.getState();
    return s.doc.objects.filter((o) => s.selection.includes(o.id) && !o.locked);
  }, []);
  const first = CONVERSIONS.find((c) => applies(c.id, sel))?.id ?? "fillToSatin";
  const last = localStorage.getItem(KEY + ".last") as ConvertId | null;
  const [id, setId] = useState<ConvertId>(pending ?? (last && CONVERSIONS.some((c) => c.id === last) && applies(last, sel) ? last : first));
  const [opts, setOpts] = useState<ConvertOptions>(loadOptions);
  const [preview, setPreview] = useState(true);
  const [plan, setPlan] = useState<ConvertPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const applied = useRef(false);
  const run = useRef(0);
  useEffect(() => {
    pending = null;
  }, []);

  // the objects and their groups as they were (a preview may dissolve or add groups)
  const restore = () => useStore.getState().liveUpdate((d) => ({ ...d, ...base }));

  // compute the plan (debounced) and preview it on the canvas
  useEffect(() => {
    const ticket = ++run.current;
    setBusy(true);
    const t = setTimeout(async () => {
      let r: ConvertPlan | string;
      try {
        r = await planConversion(id, sel, opts);
      } catch (e) {
        r = String((e as Error)?.message ?? e);
      }
      if (ticket !== run.current) return;
      setBusy(false);
      if (typeof r === "string") {
        setPlan(null);
        setError(r);
        restore();
        return;
      }
      setPlan(r);
      setError(null);
      if (preview) useStore.getState().liveUpdate((d) => applyPlan({ ...d, ...base }, r as ConvertPlan));
      else restore();
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, opts, preview]);
  // closing without Apply restores the shapes
  useEffect(
    () => () => {
      // a plan still being worked out is dropped (it would land after the restore)
      run.current++;
      if (!applied.current) restore();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const set = <K extends keyof ConvertOptions>(k: K, patch: Partial<ConvertOptions[K]>) =>
    setOpts((p) => {
      const next = { ...p, [k]: { ...p[k], ...patch } };
      safeSetItem(KEY, JSON.stringify(next));
      return next;
    });
  const choose = (k: ConvertId) => {
    setId(k);
    safeSetItem(KEY + ".last", k);
  };
  const apply = () => {
    if (!plan) return;
    const s = useStore.getState();
    applied.current = true;
    restore();
    s.commit((d) => applyPlan(d, plan));
    s.select(plan.select);
    s.toast(plan.summary, "success");
    onClose();
  };
  const conv = CONVERSIONS.find((c) => c.id === id)!;
  const o = opts;
  const hasCutLines = sel.some((x) => !x.text && x.stitch.type !== "fill" && x.paths.some((sp) => !sp.closed && sp.nodes.length >= 2));
  const hasLines = sel.some((x) => !x.text && x.stitch.type !== "satin" && x.stitch.type !== "fill");

  return (
    <Dialog
      live
      title={t("filum.finestre.convert_shapes")}
      onClose={onClose}
      wide
      footer={
        <>
          <label className="fx-preview">
            <Toggle on={preview} onChange={setPreview} />{t("filum.finestre.preview")}
          </label>
          <span className="stat">{busy ? t("filum.finestre.working") : error ? "" : plan?.summary}</span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.finestre.cancel")}
          </button>
          <button className="btn primary" disabled={!plan || busy} onClick={apply}>
            {t("filum.finestre.apply")}
          </button>
        </>
      }
    >
      <div className="fx">
        <div className="fx-list">
          {CONVERSIONS.map((c) => (
            <button key={c.id} className={`fx-card ${id === c.id ? "on" : ""} ${applies(c.id, sel) ? "" : "dim"}`} title={c.title} onClick={() => choose(c.id)}>
              <IconSvg icon={c.icon} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className="fx-params">
          <h3>{conv.menu.replace("…", "")}</h3>
          <p className="hint">{conv.title}.</p>
          {error && <p className="hint warn">{error}</p>}
          {id === "fillToSatin" && (
            <>
              <p className="hint">{t("filum.finestre.select_the_fill_together_with")}</p>
              <Row label={t("filum.finestre.start_end_at_rung")} title={t("filum.finestre.leave_out_the_rounded_ends")}>
                <Toggle on={o.fillToSatin.skipEndSection} onChange={(v) => set("fillToSatin", { skipEndSection: v })} />
              </Row>
              <Row label={t("filum.finestre.underlay")}>
                <div className="seg">
                  {UNDERLAYS().map(([k, label, , title]) => (
                    <button key={k} title={title} className={o.fillToSatin.underlay === k ? "on" : ""} onClick={() => set("fillToSatin", { underlay: k })}>
                      {label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label={t("filum.finestre.pull_compensation")} title={t("filum.finestre.widen_the_columns_so_they")}>
                <Num value={o.fillToSatin.pullComp} unit="mm" step={0.05} min={-10} max={10} onChange={(v) => set("fillToSatin", { pullComp: v })} />
              </Row>
              <Row label={t("filum.finestre.keep")} title={t("filum.finestre.what_stays_of_the_selection")}>
                <div className="seg">
                  {(
                    [
                      ["unused", t("filum.finestre.unconverted_parts"), t("filum.finestre.parts_of_the_fill_no")],
                      ["none", t("filum.finestre.nothing"), t("filum.finestre.remove_the_fills_and_the")],
                      ["fills", t("filum.finestre.fills"), t("filum.finestre.keep_the_fills_remove_the")],
                      ["all", t("filum.finestre.all"), t("filum.finestre.keep_the_fills_and_the")],
                    ] as const
                  ).map(([k, label, title]) => (
                    <button key={k} title={title} className={o.fillToSatin.keep === k ? "on" : ""} onClick={() => set("fillToSatin", { keep: k })}>
                      {label}
                    </button>
                  ))}
                </div>
              </Row>
            </>
          )}
          {id === "fillToStroke" && (
            <>
              <Row label={t("filum.finestre.stitch_as")} title={t("filum.finestre.running_stitch_along_the_centre")}>
                <div className="seg">
                  <button className={o.fillToStroke.output === "running" ? "on" : ""} onClick={() => set("fillToStroke", { output: "running" })}>
                    {t("filum.finestre.running_stitch")}
                  </button>
                  <button className={o.fillToStroke.output === "satin" ? "on" : ""} onClick={() => set("fillToStroke", { output: "satin" })}>
                    Satin
                  </button>
                </div>
              </Row>
              <Row label={t("filum.finestre.dead_ends_under")} title={t("filum.finestre.side_branches_shorter_than_this")}>
                <Slider min={0} max={30} step={0.5} unit="mm" value={o.fillToStroke.deadEnd} onChange={(v) => set("fillToStroke", { deadEnd: v })} />
              </Row>
              <Row label={t("filum.finestre.keep_original")} title={t("filum.finestre.keep_the_fill_and_the")}>
                <Toggle on={o.fillToStroke.keepOriginal} onChange={(v) => set("fillToStroke", { keepOriginal: v })} />
              </Row>
              {hasCutLines && (
                <Row label={t("filum.finestre.close_gaps_at_cuts")} title={t("filum.finestre.lines_ending_at_a_cut")}>
                  <Toggle on={o.fillToStroke.closeGaps} onChange={(v) => set("fillToStroke", { closeGaps: v })} />
                </Row>
              )}
              <p className="hint">{hasCutLines ? t("filum.finestre.the_selected_lines_cut_the") : t("filum.finestre.tip_select_lines_with_the")}</p>
            </>
          )}
          {id === "satinToStroke" && (
            <Row label={t("filum.finestre.keep_satin")} title={t("filum.finestre.keep_the_satin_column_too")}>
              <Toggle on={o.satinToStroke.keepSatin} onChange={(v) => set("satinToStroke", { keepSatin: v })} />
            </Row>
          )}
          {id === "satinToRails" && (
            <>
              <p className="hint">{t("filum.finestre.the_satin_keeps_its_width")}</p>
              {hasLines && (
                <Row label={t("filum.finestre.width_of_lines")} title={t("filum.finestre.column_width_for_selected_running")}>
                  <Num value={o.satinToRails.width} unit="mm" step={0.1} min={0.3} max={20} onChange={(v) => set("satinToRails", { width: v })} />
                </Row>
              )}
            </>
          )}
          {id === "zigzagToSatin" && (
            <>
              <div className="fx-warps">
                {ZIGZAGS.map((z) => (
                  <button key={z.id} title={z.title} className={o.zigzagToSatin.pattern === z.id ? "on" : ""} onClick={() => set("zigzagToSatin", { pattern: z.id })}>
                    <svg viewBox="0 0 30 32">
                      <path d={polyline(z.pts)} style={{ fill: "none" }} />
                    </svg>
                    <span>{z.label}</span>
                  </button>
                ))}
              </div>
              <Row label={t("filum.finestre.smoothing")} title={t("filum.finestre.smooth_curves_through_the_rail")}>
                <Toggle on={o.zigzagToSatin.smoothing} onChange={(v) => set("zigzagToSatin", { smoothing: v })} />
              </Row>
              <Row label={t("filum.finestre.rungs")} title={t("filum.finestre.keep_the_stitch_direction_of")}>
                <Toggle on={o.zigzagToSatin.rungs} onChange={(v) => set("zigzagToSatin", { rungs: v })} />
              </Row>
              {o.zigzagToSatin.rungs && o.zigzagToSatin.pattern !== "zigzag" && (
                <Row label={t("filum.finestre.fewer_rungs")} title={t("filum.finestre.every_other_rung_only")}>
                  <Toggle on={o.zigzagToSatin.reduceRungs} onChange={(v) => set("zigzagToSatin", { reduceRungs: v })} />
                </Row>
              )}
            </>
          )}
          {id === "patternSatin" && (
            <>
              <div className="fx-warps">
                {SATIN_PATTERNS.map((p) => (
                  <button key={p.id} className={o.patternSatin.pattern === p.id ? "on" : ""} onClick={() => set("patternSatin", { pattern: p.id as SatinPattern })}>
                    <svg viewBox="0 0 32 32">
                      <path d={outlineOf(patternSatin({ closed: false, nodes: [{ p: [1, 16] }, { p: [31, 16] }] }, { pattern: p.id, minWidth: 5, maxWidth: 12, length: 10, stretched: true, rungs: false }) ?? [])} />
                    </svg>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
              <Row label={t("filum.finestre.min_width")} title={t("filum.finestre.the_narrowest_point_of_the")}>
                <Slider min={0.5} max={20} step={0.1} unit="mm" value={o.patternSatin.minWidth} onChange={(v) => set("patternSatin", { minWidth: v })} />
              </Row>
              {o.patternSatin.pattern !== "normal" && (
                <Row label={t("filum.finestre.max_width")} title={t("filum.finestre.the_widest_point_of_the")}>
                  <Slider min={0.5} max={30} step={0.1} unit="mm" value={o.patternSatin.maxWidth} onChange={(v) => set("patternSatin", { maxWidth: v })} />
                </Row>
              )}
              <Row label={t("filum.finestre.repeat_length")} title={t("filum.finestre.length_of_one_pattern_repeat")}>
                <Slider min={1} max={60} step={0.5} unit="mm" value={o.patternSatin.length} onChange={(v) => set("patternSatin", { length: v })} />
              </Row>
              <Row label={t("filum.finestre.stretch_to_fit")} title={t("filum.finestre.stretch_the_repeats_so_they")}>
                <Toggle on={o.patternSatin.stretched} onChange={(v) => set("patternSatin", { stretched: v })} />
              </Row>
              <Row label={t("filum.finestre.rungs")} title={t("filum.finestre.a_rung_in_every_repeat")}>
                <Toggle on={o.patternSatin.rungs} onChange={(v) => set("patternSatin", { rungs: v })} />
              </Row>
            </>
          )}
          {id === "breakApart" && (
            <>
              <Row label={t("filum.finestre.method")} title={t("filum.finestre.how_overlapping_sub_paths_are")}>
                <div className="seg">
                  <button title={t("filum.finestre.every_sub_path_is_a")} className={o.breakApart.method === "simple" ? "on" : ""} onClick={() => set("breakApart", { method: "simple" })}>
                    {t("filum.finestre.simple")}
                  </button>
                  <button title={t("filum.finestre.overlapping_sub_paths_cancel_out")} className={o.breakApart.method === "complex" ? "on" : ""} onClick={() => set("breakApart", { method: "complex" })}>
                    {t("filum.finestre.complex")}
                  </button>
                </div>
              </Row>
              <Row label={t("filum.finestre.remove_smaller_than")} title={t("filum.finestre.shapes_and_holes_smaller_than")}>
                <Num value={o.breakApart.minArea} unit="mm²" step={0.5} min={0.05} max={100} onChange={(v) => set("breakApart", { minArea: v })} />
              </Row>
              <p className="hint">{t("filum.finestre.a_shape_that_is_already")}</p>
            </>
          )}
          {id === "connectLines" && (
            <>
              <Row label={t("filum.finestre.join_ends_within")} title={t("filum.finestre.line_ends_closer_than_this")}>
                <Num value={o.connectLines.join} unit="mm" step={0.1} min={0.01} max={5} digits={2} onChange={(v) => set("connectLines", { join: v })} />
              </Row>
              <Row label={t("filum.finestre.bridge_gaps_up_to")} title={t("filum.finestre.loose_ends_this_close_are")}>
                <Num value={o.connectLines.bridge} unit="mm" step={0.5} min={0} max={50} digits={1} onChange={(v) => set("connectLines", { bridge: v })} />
              </Row>
              <Row label={t("filum.finestre.straight_through")} title={t("filum.finestre.where_lines_cross_or_branch")}>
                <Toggle on={o.connectLines.straight} onChange={(v) => set("connectLines", { straight: v })} />
              </Row>
              <Row label={t("filum.finestre.leave_out_doubled")} title={t("filum.finestre.pieces_lying_on_top_of")}>
                <Toggle on={o.connectLines.dropDoubled} onChange={(v) => set("connectLines", { dropDoubled: v })} />
              </Row>
              <p className="hint">{t("filum.finestre.lines_of_one_colour_and")}</p>
            </>
          )}
          {id === "dedupe" && (
            <>
              <Row label={t("filum.finestre.distance")} title={t("filum.finestre.a_point_closer_than_this")}>
                <Num value={o.dedupe.distance} unit="mm" step={0.01} min={0} max={10} digits={3} onChange={(v) => set("dedupe", { distance: v })} />
              </Row>
              <Row label={t("filum.finestre.look_back")} title={t("filum.finestre.compare_with_this_many_points")}>
                <Num value={o.dedupe.window} step={1} min={1} max={5000} digits={0} onChange={(v) => set("dedupe", { window: Math.round(v) })} />
              </Row>
            </>
          )}
          {!sel.length && <p className="hint warn">{t("filum.finestre.select_the_objects_to_convert")}</p>}
        </div>
      </div>
    </Dialog>
  );
}

/** Context bar: the conversions that apply to the selection. */
export function ConvertMenuButton({ objects }: { objects: DesignObject[] }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const items = CONVERSIONS.filter((c) => applies(c.id, objects));
  useEffect(() => {
    if (!at) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".convert-menu,.convert-btn")) setAt(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [at]);
  if (!items.length) return null;
  return (
    <>
      <button
        className="btn sm ghost convert-btn"
        title={t("filum.finestre.convert_the_selection_fill_satin")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 4 });
        }}
      >
        <ArrowRightLeft size={13} />{t("filum.finestre.convert")}<ChevronDown size={11} />
      </button>
      {at && (
        <div className="menu convert-menu" style={{ left: at.x, top: at.y }}>
          {items.map((c) => (
            <button
              key={c.id}
              className="menu-item"
              title={c.title}
              onClick={() => {
                setAt(null);
                openConvert(c.id);
              }}
            >
              <span className="check" />
              {c.menu}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
