// Module m (Satin tools) starts here: module 0 finds this file and calls install() once.
// For now only the commands: the canvas tools join Filum's through module 0's
// drawing tool registry when it is in main.

import { registerSatinToolCommands } from "./commands";
import "./texts";

/** Module m's commands; returns the function that removes them. */
export function installSatinTools(): () => void {
  return registerSatinToolCommands();
}

export function install(): void {
  installSatinTools();
}
