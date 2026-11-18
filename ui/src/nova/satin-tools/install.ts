// Module m (Satin tools) starts here: module 0 finds this file and calls install() once.
// The commands, and the two canvas tools through module 0's drawing tool registry.

import { registerSatinToolCommands } from "./commands";
import { registerSatinTools } from "./tools";
import "./texts";

/** Module m's commands and tools; returns the function that removes them. */
export function installSatinTools(): () => void {
  const offs = [registerSatinToolCommands(), registerSatinTools()];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installSatinTools();
}
