// Ink/Stitch's defaults per stitch type, applied to an object's settings
// without touching its style (width, method, angle, triple / bean …): the
// panel's "Ink/Stitch" defaults button, and whether an object holds them.
// The values themselves are in lib/inkDefaults.ts (new objects start there).

import { t } from "../nova/i18n/filum";
import { INK_FILL_METHODS, INK_RUNNING, INK_SATIN, INK_TATAMI } from "./inkDefaults";
import type { FillParams, StitchParams } from "../types";

const RUNNING_KEYS = ["length", "tolerance"] as const;
const SATIN_KEYS = [
  "spacing",
  "pullComp",
  "pullCompPct",
  "maxStitchLength",
  "shortStitchInset",
  "centerWalk",
  "contourUnderlay",
  "contourInset",
  "zigzagUnderlay",
  "zigzagUnderlaySpacing",
  "zigzagUnderlayInset",
  "underlayAuto",
] as const;
const FILL_KEYS = [
  "rowSpacing",
  "endRowSpacing",
  "maxStitchLength",
  "staggers",
  "pullComp",
  "underlay",
  "underlayAngle",
  "underlaySpacing",
  "underlayInset",
  "underlayStitchLength",
  "underlayAuto",
  "travelLength",
] as const;
const FILL_EXTRA: Partial<Record<FillParams["method"], string[]>> = {
  meander: ["meanderScale", "smoothness"],
  cross: ["crossSize", "crossCoverage"],
};

const pick = (src: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => k in src).map((k) => [k, src[k]]));

/** The values Ink/Stitch gives this object's stitch type (null: it has none, e.g. a fill method it lacks). */
export function inkDefaults(st: StitchParams): Record<string, unknown> | null {
  switch (st.type) {
    case "running":
      if (st.ripple || st.motif) return null;
      return pick(INK_RUNNING, RUNNING_KEYS);
    case "satin":
      return pick(INK_SATIN, SATIN_KEYS);
    case "fill": {
      if (st.gradient || st.ramp) return null;
      const m = INK_FILL_METHODS[st.method];
      return m ? pick({ ...INK_TATAMI, ...m }, [...FILL_KEYS, ...(FILL_EXTRA[st.method] ?? [])]) : null;
    }
    default:
      return null;
  }
}

const same = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-6 : a === b);

/** Does the object hold exactly Ink/Stitch's values? */
export function holdsInkDefaults(st: StitchParams): boolean {
  const v = inkDefaults(st);
  if (!v) return false;
  const cur = st as unknown as Record<string, unknown>;
  return Object.entries(v).every(([k, x]) => same(cur[k] ?? (typeof x === "number" ? 0 : false), x));
}

const LABELS: Record<string, string> = {
  get length() { return t("filum.pannelli.impostazione.length"); },
  get tolerance() { return t("filum.pannelli.impostazione.tolerance"); },
  get spacing() { return t("filum.pannelli.impostazione.spacing"); },
  get pullComp() { return t("filum.pannelli.impostazione.pullComp"); },
  get pullCompPct() { return t("filum.pannelli.impostazione.pullCompPct"); },
  get maxStitchLength() { return t("filum.pannelli.impostazione.maxStitchLength"); },
  get shortStitchInset() { return t("filum.pannelli.impostazione.shortStitchInset"); },
  get centerWalk() { return t("filum.pannelli.impostazione.centerWalk"); },
  get contourUnderlay() { return t("filum.pannelli.impostazione.contourUnderlay"); },
  get contourInset() { return t("filum.pannelli.impostazione.contourInset"); },
  get zigzagUnderlay() { return t("filum.pannelli.impostazione.zigzagUnderlay"); },
  get zigzagUnderlaySpacing() { return t("filum.pannelli.impostazione.zigzagUnderlaySpacing"); },
  get zigzagUnderlayInset() { return t("filum.pannelli.impostazione.zigzagUnderlayInset"); },
  get rowSpacing() { return t("filum.pannelli.impostazione.rowSpacing"); },
  get endRowSpacing() { return t("filum.pannelli.impostazione.endRowSpacing"); },
  get staggers() { return t("filum.pannelli.impostazione.staggers"); },
  get underlay() { return t("filum.pannelli.impostazione.underlay"); },
  get underlayAngle() { return t("filum.pannelli.impostazione.underlayAngle"); },
  get underlaySpacing() { return t("filum.pannelli.impostazione.underlaySpacing"); },
  get underlayInset() { return t("filum.pannelli.impostazione.underlayInset"); },
  get underlayStitchLength() { return t("filum.pannelli.impostazione.underlayStitchLength"); },
  get underlayAuto() { return t("filum.pannelli.impostazione.underlayAuto"); },
  get travelLength() { return t("filum.pannelli.impostazione.travelLength"); },
  get meanderScale() { return t("filum.pannelli.impostazione.meanderScale"); },
  get smoothness() { return t("filum.pannelli.impostazione.smoothness"); },
  get crossSize() { return t("filum.pannelli.impostazione.crossSize"); },
  get crossCoverage() { return t("filum.pannelli.impostazione.crossCoverage"); },
};

const fmt = (v: unknown) => (typeof v === "boolean" ? (v ? t("filum.pannelli.impostazione_on") : t("filum.pannelli.impostazione_off")) : typeof v === "number" ? String(+v.toFixed(3)) : String(v));

/** "row spacing 0.25, underlay off …": what the Ink/Stitch defaults would change on this object. */
export function inkChanges(st: StitchParams): string[] {
  const v = inkDefaults(st);
  if (!v) return [];
  const cur = st as unknown as Record<string, unknown>;
  return Object.entries(v)
    .filter(([k, x]) => !same(cur[k] ?? (typeof x === "number" ? 0 : false), x))
    .map(([k, x]) => `${LABELS[k] ?? k} ${fmt(x)}`);
}
