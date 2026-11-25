// Auto underlay: what the engine chooses (crates/core/src/stitches/underlay.rs),
// described for the panel. Keep the widths in step with the engine.

import { t } from "../nova/i18n/filum";
import type { Fabric } from "../types";

/** Soft, stretchy or pile fabrics: heavier auto underlay. */
export const STRETCH: Fabric[] = ["knit", "fleece", "towel", "pique", "sheer"];
/** Delicate or firm fabrics where every needle hole shows: lighter. */
export const DELICATE: Fabric[] = ["silk", "leather"];
/** Pile fabrics: a knockdown keeps the embroidery from sinking in. */
export const PILE: Fabric[] = ["towel", "fleece"];

const mm = (v: number) => `${v} mm`;

/** What auto underlay does to a fill on this fabric. */
export function autoFillHint(fabric: Fabric, knockdown: boolean): string {
  if (knockdown) return t("filum.dati.ul_knockdown_on");
  const [tiny, narrow] = DELICATE.includes(fabric) ? [3, 12] : STRETCH.includes(fabric) ? [2, 6] : [2.5, 8];
  const big = STRETCH.includes(fabric) ? t("filum.dati.ul_edge_crosshatch") : t("filum.dati.ul_edge_tatami");
  return t("filum.dati.ul_fill_hint", { tiny: mm(tiny), narrow: mm(narrow), big });
}

/** What auto underlay does to a satin column on this fabric. */
export function autoSatinHint(fabric: Fabric, knockdown: boolean): string {
  const [none, center, contour] = DELICATE.includes(fabric) ? [1.5, 3, 5] : STRETCH.includes(fabric) ? [1, 2, 3] : [1.2, 2.5, 4];
  if (knockdown) return t("filum.dati.ul_satin_knockdown", { none: mm(none), center: mm(center) });
  return t("filum.dati.ul_satin_hint", { none: mm(none), center: mm(center), contour: mm(contour) });
}
