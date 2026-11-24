// Module j (3D and appliqué) starts here: module 0 finds this file and calls install() once.
// The appliqué's new fields in Filum's appliqué section, the foam section in Filum's satin
// section, the layered 3D stitch type (module 0's hooks, #58), and the warnings
// «3D goes last» and «layered 3D under 6 mm» in Filum's Issues list.

import { registerAppliqueFields } from "./applique";
import { registerFoam } from "./foam";
import { registerLayered3d } from "./layered3d";
import { registerIssueCheck } from "../core/issueChecks";
import { stitch3dIssues } from "./issues";
import "./texts";

/** Module j's registrations; returns the function that removes them. */
export function installStitch3d(): () => void {
  const offs = [registerAppliqueFields(), registerFoam(), registerLayered3d(), registerIssueCheck({ id: "j.stitch3d", module: "j", check: (doc) => stitch3dIssues(doc) })];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installStitch3d();
}
