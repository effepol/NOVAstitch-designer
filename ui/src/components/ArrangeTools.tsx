// Arrange toolbar (align / distribute / mirror) and the arranging
// dialogs: Wreath · Kaleidoscope · Mirror-merge, Outlines & offsets, Colour
// blending.

import { t, tn } from "../nova/i18n/filum";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, Crosshair, FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { align, distribute, mirrorSelection, outlineObject, repeatSelection, repeatTransforms, withOutline, type OutlineKind, type OutlineOptions, type RepeatMode } from "../lib/arrange";
import { centerInHoop } from "../lib/actions";
import { applyMat, objectBounds, unionBoxes } from "../lib/geometry";
import { useStore } from "../store";
import type { DesignObject, Vec2 } from "../types";
import { Dialog, Num, Row, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";

/** Align / distribute / mirror buttons for the context bar. */
export function ArrangeButtons({ count }: { count: number }) {
  const b = (title: string, icon: React.ReactNode, run: () => void, disabled = false) => (
    <button title={title} onClick={run} disabled={disabled}>
      {icon}
    </button>
  );
  const sel = count > 1;
  return (
    <>
      <div className="seg" role="group" aria-label={t("filum.pannelli.align")}>
        {b(sel ? t("filum.pannelli.align_left_selection") : t("filum.pannelli.align_left_hoop"), <AlignStartVertical size={14} />, () => align("left"))}
        {b(sel ? t("filum.pannelli.centre_h_selection") : t("filum.pannelli.centre_h_hoop"), <AlignCenterVertical size={14} />, () => align("hcenter"))}
        {b(sel ? t("filum.pannelli.align_right_selection") : t("filum.pannelli.align_right_hoop"), <AlignEndVertical size={14} />, () => align("right"))}
        {b(sel ? t("filum.pannelli.align_top_selection") : t("filum.pannelli.align_top_hoop"), <AlignStartHorizontal size={14} />, () => align("top"))}
        {b(sel ? t("filum.pannelli.centre_v_selection") : t("filum.pannelli.centre_v_hoop"), <AlignCenterHorizontal size={14} />, () => align("vcenter"))}
        {b(sel ? t("filum.pannelli.align_bottom_selection") : t("filum.pannelli.align_bottom_hoop"), <AlignEndHorizontal size={14} />, () => align("bottom"))}
      </div>
      {count > 2 && (
        <div className="seg" role="group" aria-label={t("filum.pannelli.distribute")}>
          {b(t("filum.pannelli.distribute_h"), <AlignHorizontalDistributeCenter size={14} />, () => distribute("h"))}
          {b(t("filum.pannelli.distribute_v"), <AlignVerticalDistributeCenter size={14} />, () => distribute("v"))}
        </div>
      )}
      <div className="seg" role="group" aria-label={t("filum.pannelli.mirror")}>
        {b(t("filum.pannelli.mirror_h"), <FlipHorizontal2 size={14} />, () => mirrorSelection("h"))}
        {b(t("filum.pannelli.mirror_v"), <FlipVertical2 size={14} />, () => mirrorSelection("v"))}
        {b(t("filum.pannelli.centre_in_hoop"), <Crosshair size={14} />, centerInHoop)}
      </div>
    </>
  );
}

const selectionBox = () => {
  const s = useStore.getState();
  return unionBoxes(s.doc.objects.filter((o) => s.selection.includes(o.id)).map(objectBounds));
};

function ThreadSwatches({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const threads = useStore((s) => s.doc.threads);
  return (
    <div className="thread-pick">
      {threads.map((t) => (
        <button key={t.id} title={t.name} className={t.id === value ? "on" : ""} style={{ background: t.color }} onClick={() => onChange(t.id)} />
      ))}
    </div>
  );
}

/** Small schematic of where the copies of a repeat go. */
function RepeatPreview({ mode, copies, center }: { mode: RepeatMode; copies: number; center: Vec2 }) {
  const box = selectionBox();
  const shapes = useMemo(() => {
    if (!box) return [];
    const pts: Vec2[] = [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x + box.w, box.y + box.h],
      [box.x + box.w * 0.25, box.y + box.h],
    ];
    return [{ pts, orig: true }, ...repeatTransforms({ mode, copies, center }).map(({ m }) => ({ pts: pts.map((p) => applyMat(m, p)), orig: false }))];
  }, [box, mode, copies, center]);
  const all = shapes.flatMap((s) => s.pts);
  if (!all.length) return null;
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs, center[0]), Math.max(...xs, center[0]), Math.min(...ys, center[1]), Math.max(...ys, center[1])];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + 1;
  return (
    <svg className="repeat-preview" viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`}>
      {shapes.map((s, i) => (
        <polygon key={i} points={s.pts.map((p) => p.join(",")).join(" ")} className={s.orig ? "orig" : ""} />
      ))}
      <circle cx={center[0]} cy={center[1]} r={pad * 0.25} />
    </svg>
  );
}

export function RepeatDialog({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const [mode, setMode] = useState<RepeatMode>("wreath");
  const [copies, setCopies] = useState(6);
  const [around, setAround] = useState<"hoop" | "radius">("radius");
  const [radius, setRadius] = useState(25);
  const box = selectionBox();
  const center: Vec2 =
    around === "hoop" || !box ? [doc.hoop.width / 2, doc.hoop.height / 2] : [box.x + box.w / 2, box.y + box.h / 2 + (mode.startsWith("mirror") ? box.h / 2 + radius / 5 : radius)];
  const rotational = mode === "wreath" || mode === "kaleidoscope";
  const total = repeatTransforms({ mode, copies, center }).length + 1;
  return (
    <Dialog
      live
      title={t("filum.pannelli.wreath_kaleidoscope_mirror_merge")}
      onClose={onClose}
      footer={
        <>
          <span className="hint">{t("filum.pannelli.total_copies_in_total", { total })}</span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.pannelli.cancel")}
          </button>
          <button
            className="btn primary"
            disabled={!box}
            onClick={() => {
              const n = repeatSelection({ mode, copies, center });
              useStore.getState().toast(t("filum.pannelli.created_n_objects", { n }), "success");
              onClose();
            }}
          >
            {t("filum.pannelli.create")}
          </button>
        </>
      }
    >
      {!box && <p className="hint warn">{t("filum.pannelli.select_the_objects_to_repeat")}</p>}
      <div className="seg" style={{ marginBottom: 10 }}>
        {(
          [
            ["wreath", t("filum.pannelli.wreath")],
            ["kaleidoscope", t("filum.pannelli.kaleidoscope")],
            ["mirrorH", t("filum.pannelli.mirror_2")],
            ["mirrorV", t("filum.pannelli.mirror_3")],
            ["mirrorHV", t("filum.pannelli.mirror_4")],
          ] as [RepeatMode, string][]
        ).map(([id, label]) => (
          <button key={id} className={mode === id ? "on" : ""} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "start" }}>
        <div>
          {rotational && (
            <Row label={t("filum.pannelli.copies")} title={t("filum.pannelli.number_of_repeats_around_the")}>
              <Num value={copies} step={1} min={2} max={36} digits={0} onChange={(v) => setCopies(Math.round(v))} />
            </Row>
          )}
          <Row label={t("filum.pannelli.centre")}>
            <div className="seg">
              <button className={around === "radius" ? "on" : ""} onClick={() => setAround("radius")}>
                {rotational ? t("filum.pannelli.below_selection") : t("filum.pannelli.next_to_selection")}
              </button>
              <button className={around === "hoop" ? "on" : ""} onClick={() => setAround("hoop")}>
                {t("filum.pannelli.hoop_centre")}
              </button>
            </div>
          </Row>
          {around === "radius" && rotational && (
            <Row label={t("filum.pannelli.radius")} title={t("filum.pannelli.distance_from_the_selection_s")}>
              <Num value={radius} unit="mm" step={1} min={1} onChange={setRadius} />
            </Row>
          )}
          <p className="hint">
            {mode === "wreath" && t("filum.pannelli.copies_rotate_around_the_centre")}
            {mode === "kaleidoscope" && t("filum.pannelli.rotated_copies_plus_their_mirror")}
            {mode.startsWith("mirror") && t("filum.pannelli.mirror_images_joined_at_the")}{t("filum.pannelli.fill_angles_follow_every_copy")}
          </p>
        </div>
        <RepeatPreview mode={mode} copies={copies} center={center} />
      </div>
    </Dialog>
  );
}

/** Remembered settings of the outline dialog. */
const OUTLINE_KEY = "filum.outline";
interface OutlineSettings {
  kind: OutlineKind;
  offset: number;
  width: number;
  bridge: number;
  outerOnly: boolean;
}
const OUTLINE_DEFAULTS: OutlineSettings = { kind: "triple", offset: 1.5, width: 3, bridge: 0, outerOnly: false };
const loadOutline = (): OutlineSettings => {
  try {
    return { ...OUTLINE_DEFAULTS, ...JSON.parse(localStorage.getItem(OUTLINE_KEY) ?? "{}") };
  } catch {
    return OUTLINE_DEFAULTS;
  }
};

/**
 * Outlines & offsets: a running, triple or satin outline, a
 * backing fill or an appliqué around the selection — previewed live with its
 * stitches. Patch borders: Bridge gaps joins pieces that don't touch into one
 * border, Outer edge only leaves the holes out.
 */
export function OutlineDialog({ onClose }: { onClose: () => void }) {
  // the design and selection as they were when the dialog opened (the preview is added to it)
  const [orig] = useState(() => useStore.getState().doc);
  const [ids] = useState(() => useStore.getState().selection.filter((id) => orig.objects.some((o) => o.id === id && o.visible)));
  const firstThread = orig.objects.find((o) => ids.includes(o.id))?.thread ?? orig.threads[0]?.id ?? "";
  const [o, setO] = useState(loadOutline);
  const [thread, setThread] = useState(firstThread);
  const [behind, setBehind] = useState(o.kind === "fill" || o.kind === "applique");
  const [preview, setPreview] = useState<DesignObject | null>(null);
  const [busy, setBusy] = useState(false);
  const created = useRef(false);
  const set = (p: Partial<OutlineSettings>) =>
    setO((v) => {
      const next = { ...v, ...p };
      safeSetItem(OUTLINE_KEY, JSON.stringify(next));
      return next;
    });
  const opt: OutlineOptions = { kind: o.kind, offset: o.offset, width: o.width, thread, behind, bridge: o.bridge, outerOnly: o.outerOnly };

  // live preview: the outline object itself, with its stitches
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    const t = setTimeout(async () => {
      const obj = await outlineObject(orig, ids, opt);
      if (!live) return;
      setPreview(obj);
      useStore.getState().liveUpdate(() => (obj ? withOutline(orig, ids, obj, behind) : orig));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, thread, behind]);
  // closing without Create takes the preview away
  useEffect(
    () => () => {
      if (!created.current && ids.length) useStore.getState().liveUpdate(() => orig);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const create = async () => {
    setBusy(true);
    try {
      const obj = preview ?? (await outlineObject(orig, ids, opt));
      if (!obj) {
        useStore.getState().toast(t("filum.pannelli.nothing_to_outline"), "error");
        setBusy(false);
        return;
      }
      created.current = true;
      const s = useStore.getState();
      s.liveUpdate(() => orig);
      s.commit((d) => withOutline(d, ids, obj, behind));
      s.select([obj.id]);
      s.toast(t("filum.pannelli.name_outlines", { name: obj.name, outlines: tn("filum.pannelli.n_outlines", obj.paths.length) }), "success");
      onClose();
    } catch (e) {
      useStore.getState().toast(String((e as Error).message ?? e), "error");
      setBusy(false);
    }
  };

  const kinds: [OutlineKind, string, string][] = [
    ["running", t("filum.pannelli.run"), t("filum.pannelli.running_stitch_outline")],
    ["triple", t("filum.pannelli.triple_run"), t("filum.pannelli.bold_triple_bean_stitch_outline")],
    ["satin", t("filum.pannelli.satin_border"), t("filum.pannelli.satin_column_along_the_outline")],
    ["fill", t("filum.pannelli.backing_fill"), t("filum.pannelli.a_filled_shape_behind_the")],
    ["applique", t("filum.pannelli.applique"), t("filum.pannelli.placement_tack_down_and_cover")],
  ];
  // how many separate outlines the result has (outer edges and holes)
  const pieces = preview?.paths.length ?? 0;
  const patchKind = o.kind === "satin" || o.kind === "fill" || o.kind === "applique";
  return (
    <Dialog
      live
      title={t("filum.pannelli.outlines_offsets")}
      onClose={onClose}
      footer={
        <>
          <span className="stat">{ids.length ? (pieces ? tn("filum.pannelli.n_outlines", pieces) : "—") : ""}</span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.pannelli.cancel")}
          </button>
          <button className="btn primary" disabled={!ids.length || busy || !preview} onClick={create}>
            {busy ? t("filum.pannelli.working") : t("filum.pannelli.create")}
          </button>
        </>
      }
    >
      {!ids.length && <p className="hint warn">{t("filum.pannelli.select_the_objects_to_outline")}</p>}
      <div className="seg" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        {kinds.map(([id, label, title]) => (
          <button
            key={id}
            title={title}
            className={o.kind === id ? "on" : ""}
            onClick={() => {
              // patch borders: one border around the whole art by default
              set(id === "satin" || id === "fill" || id === "applique" ? { kind: id, outerOnly: true, bridge: Math.max(o.bridge, 2) } : { kind: id });
              setBehind(id === "fill" || id === "applique");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <Row label={t("filum.pannelli.offset")} title={t("filum.pannelli.distance_from_the_design_negative")}>
        <Num value={o.offset} unit="mm" step={0.5} min={-10} max={50} onChange={(v) => set({ offset: v })} />
      </Row>
      {(o.kind === "satin" || o.kind === "applique") && (
        <Row label={o.kind === "satin" ? t("filum.pannelli.width") : t("filum.pannelli.cover_width")}>
          <Num value={o.width} unit="mm" step={0.1} min={0.5} max={12} onChange={(v) => set({ width: v })} />
        </Row>
      )}
      <Row label={t("filum.pannelli.bridge_gaps")} title={t("filum.pannelli.join_pieces_of_the_art")}>
        <Num value={o.bridge} unit="mm" step={0.5} min={0} max={50} onChange={(v) => set({ bridge: v })} />
      </Row>
      <Row label={t("filum.pannelli.outer_edge_only")} title={t("filum.pannelli.no_outlines_around_holes_letter")}>
        <Toggle on={o.outerOnly} onChange={(v) => set({ outerOnly: v })} />
      </Row>
      <Row label={t("filum.pannelli.colour")}>
        <ThreadSwatches value={thread} onChange={setThread} />
      </Row>
      <Row label={t("filum.pannelli.sew_it_first")} title={t("filum.pannelli.place_the_new_object_behind")}>
        <Toggle on={behind} onChange={setBehind} />
      </Row>
      {pieces > 1 && patchKind ? (
        <p className="hint warn">
          {o.outerOnly ? t("filum.pannelli.separate_outlines_outer_only", { n: pieces }) : t("filum.pannelli.separate_outlines_with_holes", { n: pieces })}
        </p>
      ) : (
        <p className="hint">{t("filum.pannelli.follows_the_union_of_everything")}</p>
      )}
    </Dialog>
  );
}

