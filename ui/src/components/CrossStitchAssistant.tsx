// Cross stitch for shapes (Ink/Stitch cross-stitch assistant): fill shapes
// get cross stitch settings and can be snapped to the grid, and the canvas
// grid goes on the cells. Pictures become cross stitch in the digitizer
// (Cross stitch output), which shares the colour work of every other style.

import { ImageUp } from "lucide-react";
import { useState } from "react";
import { crossParams, gridOver, pixelate, ringsToPaths } from "../lib/crossStitch";
import { openDigitizer } from "../lib/actions";
import { flatten, objectBounds, unionBoxes } from "../lib/geometry";
import { useStore } from "../store";
import type { CrossKind, DesignObject, FillParams } from "../types";
import { Dialog, Num, Row, Slider, Toggle } from "./ui";
import { t, tn, useLanguage } from "../nova/i18n/filum";

export const CROSS_KINDS = (): [CrossKind, string, string][] => [
  ["cross", "×", t("filum.digitalizza.both_diagonals")],
  ["half", "/", t("filum.digitalizza.half_cross")],
  ["upright", "+", t("filum.digitalizza.upright_cross")],
  ["double", "✳", t("filum.digitalizza.double_cross")],
  ["smyrna", "⁜", t("filum.digitalizza.smyrna_cross")],
];

export function CrossStitchDialog({ onClose }: { onClose: () => void }) {
  useLanguage();
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const fills = doc.objects.filter((o) => selection.includes(o.id) && o.stitch.type === "fill" && o.paths.some((p) => p.closed));
  const [sx, setSx] = useState(2.5);
  const [sy, setSy] = useState(2.5);
  const [square, setSquare] = useState(true);
  const [kind, setKind] = useState<CrossKind>("cross");
  const [coverage, setCoverage] = useState(0.5);
  const [pixel, setPixel] = useState(true);
  const [noOverlap, setNoOverlap] = useState(true);
  const [grid, setGrid] = useState(true);
  const cellY = square ? sx : sy;
  const params: Partial<FillParams> = crossParams(sx, cellY, kind, coverage);

  const apply = () => {
    const s = useStore.getState();
    const ids = fills.map((o) => o.id);
    if (!pixel) {
      s.commit((d) => ({ ...d, objects: d.objects.map((o) => (ids.includes(o.id) && o.stitch.type === "fill" ? { ...o, stitch: { ...o.stitch, ...params } } : o)) }));
    } else {
      const b = unionBoxes(fills.map(objectBounds));
      if (!b) return;
      const g = gridOver(b.x, b.y, b.w, b.h, sx, cellY);
      const shapes = fills.map((o) => ({ rings: o.paths.filter((p) => p.closed).map((p) => flatten(p, 12)) }));
      const cut = pixelate(shapes, g, coverage, noOverlap);
      s.commit((d) => ({
        ...d,
        objects: d.objects
          .map((o) => {
            const k = ids.indexOf(o.id);
            if (k < 0 || o.stitch.type !== "fill") return o;
            return cut[k].length ? { ...o, paths: ringsToPaths(cut[k]), stitch: { ...o.stitch, ...params } } : null;
          })
          .filter((o): o is DesignObject => !!o),
      }));
    }
    if (grid) s.set({ showGrid: true, gridStep: sx });
    s.toast(`${tn("filum.digitalizza.shapes_set_as_cross_stitch", fills.length)}${pixel ? t("filum.digitalizza.snapped_to_the_grid") : ""}`);
    onClose();
  };

  return (
    <Dialog
      title={t("filum.digitalizza.cross_stitch_shapes")}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn ghost"
            title={t("filum.digitalizza.pictures_become_cross_stitch_in")}
            onClick={() => {
              onClose();
              openDigitizer("cross");
            }}
          >
            <ImageUp size={14} />{t("filum.digitalizza.from_a_picture")}
          </button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.digitalizza.cancel")}
          </button>
          <button className="btn primary" disabled={!fills.length} onClick={apply}>
            {t("filum.digitalizza.make_cross_stitch")}
          </button>
        </>
      }
    >
      {!fills.length && <p className="hint">{t("filum.digitalizza.select_fill_shapes_to_stitch")}</p>}
      <Row label={t("filum.digitalizza.cell")} title={t("filum.digitalizza.size_of_one_cross_ink")}>
        <span className="dz-inline">
          <Num value={sx} step={0.1} min={0.8} max={12} unit="mm" onChange={setSx} />
          {!square && <Num value={sy} step={0.1} min={0.8} max={12} unit="mm" onChange={setSy} />}
          <Toggle on={square} onChange={setSquare} title={t("filum.digitalizza.square_cells")} />
        </span>
      </Row>
      <Row label={t("filum.digitalizza.stitches")}>
        <div className="seg">
          {CROSS_KINDS().map(([k, l, t]) => (
            <button key={k} title={t} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row label={t("filum.digitalizza.coverage")} title={t("filum.digitalizza.how_much_of_a_cell_2")}>
        <Slider min={10} max={100} step={5} digits={0} unit="%" value={Math.round(coverage * 100)} onChange={(v) => setCoverage(v / 100)} />
      </Row>
      <Row label={t("filum.digitalizza.snap_to_grid")} title={t("filum.digitalizza.replace_the_outlines_by_the")}>
        <Toggle on={pixel} onChange={setPixel} />
      </Row>
      {pixel && (
        <Row label={t("filum.digitalizza.no_overlaps")} title={t("filum.digitalizza.a_cell_covered_by_several")}>
          <Toggle on={noOverlap} onChange={setNoOverlap} />
        </Row>
      )}
      <Row label={t("filum.digitalizza.grid_on_the_cells")} title={t("filum.digitalizza.show_the_canvas_grid_at")}>
        <Toggle on={grid} onChange={setGrid} />
      </Row>
    </Dialog>
  );
}
