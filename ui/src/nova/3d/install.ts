// Module j (3D and appliqué) starts here: module 0 finds this file and calls install() once.
// The appliqué's new fields in Filum's appliqué section and the foam stitch type (module 0's hooks, #58).

import { registerAppliqueFields } from "./applique";
import { registerFoam } from "./foam";
import "./texts";

/** Module j's registrations; returns the function that removes them. */
export function installStitch3d(): () => void {
  const offs = [registerAppliqueFields(), registerFoam()];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installStitch3d();
}
