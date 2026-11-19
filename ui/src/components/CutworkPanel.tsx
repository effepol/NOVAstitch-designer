// Cutwork: split cut lines for the cutwork needles (knives that each cut
// in a range of directions), Ink/Stitch cutwork segmentation. The needle
// ranges and colours are remembered.

import { t, tn } from "../nova/i18n/filum";
import { useState } from "react";
import { CUTWORK_SECTORS, cutworkSegmentation, type CutworkSector } from "../lib/cutwork";
import { useStore } from "../store";
import type { DesignObject } from "../types";
import { Num, Row, Section, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";

const KEY = "filum.cutwork";

export function cutworkSettings(): { sectors: CutworkSector[]; sortByNeedle: boolean; keepOriginals: boolean } {
  try {
    return { sectors: CUTWORK_SECTORS, sortByNeedle: true, keepOriginals: false, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { sectors: CUTWORK_SECTORS, sortByNeedle: true, keepOriginals: false };
  }
}

/** Split the selected lines for the cutwork needles. */
export function runCutwork(ids: string[]) {
  const s = useStore.getState();
  const o = cutworkSettings();
  const before = s.doc.objects.length;
  s.commit((d) => cutworkSegmentation(d, ids, o.sectors, o));
  const made = useStore.getState().doc.objects.length - before + (o.keepOriginals ? 0 : ids.length);
  s.toast(tn("filum.pannelli.cutwork_n_pieces", made));
}

export function CutworkSection({ o }: { o: DesignObject }) {
  const [cfg, setCfg] = useState(cutworkSettings);
  const save = (next: typeof cfg) => {
    setCfg(next);
    safeSetItem(KEY, JSON.stringify(next));
  };
  const setSector = (i: number, patch: Partial<CutworkSector>) => save({ ...cfg, sectors: cfg.sectors.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  if (o.stitch.type !== "running" || o.stitch.ripple) return null;
  const needle = o.stitch.cutworkNeedle;
  return (
    <Section title={t("filum.pannelli.cutwork")} defaultOpen={!!needle}>
      {needle ? (
        <p className="hint" style={{ margin: "2px 0 6px" }}>
          {t("filum.pannelli.cut_by_needle_needle", { needle })}</p>
      ) : (
        <p className="hint" style={{ margin: "2px 0 6px" }}>
          {t("filum.pannelli.split_this_line_by_direction")}
        </p>
      )}
      {cfg.sectors.map((s, i) => (
        <Row key={i} label={t("filum.pannelli.needle_v1", { v1: i + 1 })} title={t("filum.pannelli.angles_this_knife_cuts_0")}>
          <span className="dz-inline">
            <input type="color" value={s.color} onChange={(e) => setSector(i, { color: e.target.value })} />
            <Num value={s.start} step={1} min={0} max={180} digits={0} unit="°" onChange={(v) => setSector(i, { start: Math.round(v) })} />
            <Num value={s.end} step={1} min={0} max={180} digits={0} unit="°" onChange={(v) => setSector(i, { end: Math.round(v) })} />
          </span>
        </Row>
      ))}
      <Row label={t("filum.pannelli.by_needle")} title={t("filum.pannelli.sew_all_pieces_of_one")}>
        <Toggle on={cfg.sortByNeedle} onChange={(v) => save({ ...cfg, sortByNeedle: v })} />
      </Row>
      <Row label={t("filum.pannelli.keep_original")} title={t("filum.pannelli.keep_the_line_hidden_to")}>
        <Toggle on={cfg.keepOriginals} onChange={(v) => save({ ...cfg, keepOriginals: v })} />
      </Row>
      <button className="btn sm" onClick={() => runCutwork(useStore.getState().selection.length ? useStore.getState().selection : [o.id])}>
        {t("filum.pannelli.split_for_cutwork_needles")}
      </button>
    </Section>
  );
}
