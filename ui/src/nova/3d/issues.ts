// Module j's warnings (contract, module j), in Filum's Issues list through
// module 0's registry (registerIssueCheck):
//   j.foamLast    a satin over foam is not sewn last: the 3D goes last (j.5) —
//                 only a warning, the sequence is not changed
//   j.layeredThin a layered 3D under 6 mm wide (j.7)

import type { Issue } from "../../lib/issues";
import { objectBoundsCached } from "../../lib/geometry";
import { satinRails } from "../../lib/multicolorSatin";
import type { DesignObject, StitchDocument, Vec2 } from "../../types";
import { t } from "../core/i18n";
import { isFoam } from "./foam";
import { isLayered3d } from "./layered3d";
import "./texts";

/** A layered 3D narrower than this gets a warning (Punch, contract j.7; mm). */
export const LAYERED3D_MIN_WIDTH = 6;

const centre = (o: DesignObject): Vec2 | null => {
  const b = objectBoundsCached(o);
  return b ? [b.x + b.w / 2, b.y + b.h / 2] : null;
};

/** Objects that are sewn: visible, with a stitch. */
const sewn = (o: DesignObject) => o.visible && o.stitch.type !== "none";

/** A layered 3D's width: the centre line's, or the mean distance between its two rails. */
export function layeredWidth(o: DesignObject): number | null {
  const st = o.stitch;
  if (!isLayered3d(st)) return null;
  if (o.paths.filter((p) => p.nodes.length >= 2).length === 1) return st.width;
  const rails = satinRails({ ...o, stitch: { ...st, type: "satin" } });
  if (!rails) return null;
  const [a, b] = rails;
  return a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length;
}

export function stitch3dIssues(doc: StitchDocument): Issue[] {
  const out: Issue[] = [];
  const objects = doc.objects.filter(sewn);
  // the last object that is not foam: every foam before it is not sewn last
  let lastOther = -1;
  objects.forEach((o, i) => {
    if (!isFoam(o.stitch)) lastOther = i;
  });
  objects.forEach((o, i) => {
    const at = centre(o);
    if (!at) return;
    if (isFoam(o.stitch) && i < lastOther)
      out.push({ id: `j.foamLast:${o.id}`, objId: o.id, level: "warning", title: t("j.issue.foamLast.title"), detail: t("j.issue.foamLast.detail", { name: o.name }), at });
    const w = layeredWidth(o);
    if (w != null && w < LAYERED3D_MIN_WIDTH)
      out.push({ id: `j.layeredThin:${o.id}`, objId: o.id, level: "warning", title: t("j.issue.layeredThin.title"), detail: t("j.issue.layeredThin.detail", { width: +w.toFixed(1), min: LAYERED3D_MIN_WIDTH }), at });
  });
  return out;
}
