// Module j (3D and appliqué) starts here: module 0 finds this file and calls install() once.
// The appliqué's new fields in Filum's appliqué section (module 0's hook, #58).

import { registerAppliqueFields } from "./applique";
import "./texts";

/** Module j's registrations; returns the function that removes them. */
export function installStitch3d(): () => void {
  const offs = [registerAppliqueFields()];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installStitch3d();
}
