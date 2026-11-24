// Module j (3D and appliqué) starts here: module 0 finds this file and calls install() once.
// The appliqué's new fields in Filum's appliqué section, the foam section in Filum's satin
// section and the layered 3D stitch type (module 0's hooks, #58).

import { registerAppliqueFields } from "./applique";
import { registerFoam } from "./foam";
import { registerLayered3d } from "./layered3d";
import "./texts";

/** Module j's registrations; returns the function that removes them. */
export function installStitch3d(): () => void {
  const offs = [registerAppliqueFields(), registerFoam(), registerLayered3d()];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installStitch3d();
}
