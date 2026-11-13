// Test swatches (Ink/Stitch "Generate test swatches"): the selected object
// copied in a grid with one stitch setting stepped from copy to copy, each
// copy named after its value — sew once, pick the best.

import { useMemo, useState } from "react";
import { objectBoundsCached, transformObject, translateMat, uid } from "../lib/geometry";
import { useStore } from "../store";
import type { DesignObject } from "../types";
import { Dialog, Num, Row } from "./ui";
import { t, useLanguage } from "../nova/i18n/filum";

/**
 * Numeric stitch settings worth stepping, by stitch type. `scale`: shown
 * (and stepped) as the stored value times this (fractions as %).
 */
type Param = { key: string; label: string; step: number; unit: string; scale?: number };
const PARAMS: Record<string, Param[]> = {
  running: [
    { key: "length", get label() { return t("filum.digitalizza.stitch_length"); }, step: 0.5, unit: "mm" },
    { key: "beanRepeats", get label() { return t("filum.digitalizza.bean_repeats"); }, step: 2, unit: "" },
  ],
  satin: [
    { key: "spacing", get label() { return t("filum.digitalizza.spacing_density"); }, step: 0.05, unit: "mm" },
    { key: "pullComp", get label() { return t("filum.digitalizza.pull_compensation"); }, step: 0.1, unit: "mm" },
    { key: "width", get label() { return t("filum.digitalizza.width"); }, step: 0.5, unit: "mm" },
    { key: "shortStitchInset", get label() { return t("filum.digitalizza.short_stitch"); }, step: 10, unit: "%", scale: 100 },
  ],
  fill: [
    { key: "rowSpacing", get label() { return t("filum.digitalizza.row_spacing_density"); }, step: 0.05, unit: "mm" },
    { key: "pullComp", get label() { return t("filum.digitalizza.pull_compensation"); }, step: 0.1, unit: "mm" },
    { key: "angle", get label() { return t("filum.digitalizza.angle"); }, step: 15, unit: "°" },
    { key: "maxStitchLength", get label() { return t("filum.digitalizza.stitch_length"); }, step: 0.5, unit: "mm" },
    { key: "underlaySpacing", get label() { return t("filum.digitalizza.underlay_spacing"); }, step: 0.25, unit: "mm" },
  ],
};

export function TestSwatchesDialog({ onClose }: { onClose: () => void }) {
  useLanguage();
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const o = doc.objects.find((x) => selection.includes(x.id));
  // the width only shapes a satin drawn as one centre line (or several, each
  // its own column); two rails set it themselves
  const singleLine = !!o && o.stitch.type === "satin" && (o.paths.filter((sp) => sp.nodes.length >= 2).length === 1 || !!(o.stitch as { multi?: boolean }).multi);
  const params = o ? (PARAMS[o.stitch.type] ?? []).filter((x) => x.key !== "width" || singleLine) : [];
  const [key, setKey] = useState(params[0]?.key ?? "");
  const p = params.find((x) => x.key === key) ?? params[0];
  const scale = p?.scale ?? 1;
  const cur = o && p ? +(Number((o.stitch as unknown as Record<string, unknown>)[p.key] ?? 0) * scale).toFixed(4) : 0;
  const [start, setStart] = useState<number | null>(null);
  const [inc, setInc] = useState<number | null>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [gap, setGap] = useState(5);
  const from = start ?? cur;
  const step = inc ?? p?.step ?? 0.1;
  const values = useMemo(() => Array.from({ length: cols * rows }, (_, i) => +(from + i * step).toFixed(4)), [from, step, cols, rows]);
  const make = () => {
    if (!o || !p) return;
    const b = objectBoundsCached(o);
    if (!b) return;
    const copies: DesignObject[] = values.map((v, i) => {
      const dx = (i % cols) * (b.w + gap);
      const dy = Math.floor(i / cols) * (b.h + gap);
      const moved = transformObject(o, translateMat(dx, dy));
      return { ...moved, id: uid(), name: `${o.name} · ${p.label.toLowerCase()} ${v}${p.unit}`, stitch: { ...o.stitch, [p.key]: +(v / scale).toFixed(6) } as DesignObject["stitch"] };
    });
    const s = useStore.getState();
    // the swatches take the original's place in the sewing order
    s.commit((d) => ({ ...d, objects: d.objects.flatMap((x) => (x.id === o.id ? copies : [x])) }));
    s.select(copies.map((c) => c.id));
    s.toast(t("filum.digitalizza.length_swatches_v2_v3_v4", { length: copies.length, v2: p.label.toLowerCase(), v3: values[0], v4: values[values.length - 1], unit: p.unit }));
    onClose();
  };
  return (
    <Dialog
      title={t("filum.digitalizza.test_swatches")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("filum.digitalizza.cancel")}
          </button>
          <button className="btn primary" disabled={!o || !p} onClick={make}>
            {t("filum.digitalizza.make_n_swatches", { n: cols * rows })}</button>
        </>
      }
    >
      {!o || !p ? (
        <p className="hint">{t("filum.digitalizza.select_a_running_stitch_satin")}</p>
      ) : (
        <>
          <p className="hint">{t("filum.digitalizza.copies_of_name_in_a", { name: o.name })}</p>
          <Row label={t("filum.digitalizza.setting")}>
            <select className="select" style={{ width: "100%" }} value={p.key} onChange={(e) => (setKey(e.target.value), setStart(null), setInc(null))}>
              {params.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t("filum.digitalizza.from_step")}>
            <span className="dz-inline">
              <Num value={from} step={p.step} unit={p.unit} onChange={setStart} />
              <Num value={step} step={p.step / 2} unit={p.unit} onChange={setInc} />
            </span>
          </Row>
          <Row label={t("filum.digitalizza.grid")}>
            <span className="dz-inline">
              <Num value={cols} step={1} min={1} max={10} digits={0} onChange={(v) => setCols(Math.round(v))} />
              <span className="stat">×</span>
              <Num value={rows} step={1} min={1} max={10} digits={0} onChange={(v) => setRows(Math.round(v))} />
              <Num value={gap} step={1} min={0} max={50} unit="mm" onChange={setGap} />
            </span>
          </Row>
          <p className="hint">
            {t("filum.digitalizza.values")}{values.slice(0, 8).join(", ")}
            {values.length > 8 ? " …" : ""}
            {p.unit && ` ${p.unit}`}
          </p>
        </>
      )}
    </Dialog>
  );
}
