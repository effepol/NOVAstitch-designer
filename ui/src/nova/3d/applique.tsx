// Module j: the appliqué's new fields (contract, module j; Punch, decisions of
// 12/11 and 24/11) in Filum's appliqué section, through module 0's hook
// (registerStitchFields, #58): the placement line's inset and the free edge.
// The new defaults themselves are in lib/geometry.ts defaultApplique and in the core.

import { Row, Slider, Toggle } from "../../components/ui";
import { registerStitchFields, type StitchSectionProps } from "../core/stitchTypes";
import type { AppliqueParams } from "../../types";
import { t } from "../core/i18n";
import "./texts";

/** Free-edge appliqué: placement line this far inside the edge (Punch; the core's APPLIQUE_FREE_EDGE_INSET). */
export const FREE_EDGE_INSET = 5;

export function AppliqueFields({ o, up }: StitchSectionProps) {
  const st = o.stitch as AppliqueParams & { type: "applique" };
  return (
    <>
      {!st.freeEdge && (
        <Row label={t("j.applique.placementInset")} title={t("j.applique.placementInset.title")}>
          <span data-nova-anchor="j.applique.placementInset">
            <Slider min={0} max={3} step={0.05} value={st.placementInset ?? 0} unit="mm" onChange={(v) => up({ placementInset: v })} />
          </span>
        </Row>
      )}
      <Row label={t("j.applique.freeEdge")} title={t("j.applique.freeEdge.title")}>
        <span data-nova-anchor="j.applique.freeEdge">
          <Toggle on={!!st.freeEdge} onChange={(v) => up({ freeEdge: v })} title={t("j.applique.freeEdge.title")} />
        </span>
      </Row>
    </>
  );
}

export const registerAppliqueFields = (): (() => void) =>
  registerStitchFields({ id: "j.applique", module: "j", type: "applique", place: "placement", Fields: AppliqueFields });
