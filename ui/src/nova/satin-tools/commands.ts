// Module m: the satin tools' commands, each a pure function run only through
// runCommand (one command = one undo step).

import { registerCommand, type Command } from "../core/commands";
import { satinFromClicks } from "./twoRails";

export const SATIN_TOOL_COMMANDS = [
  { id: "m.satin.fromClicks", label: { it: "Satin a due binari", en: "Two-rail satin" }, apply: satinFromClicks },
] as unknown as Command<never>[];

/** Registers module m's commands; returns the function that removes them. */
export function registerSatinToolCommands(): () => void {
  const offs = SATIN_TOOL_COMMANDS.map((c) => registerCommand(c));
  return () => offs.forEach((off) => off());
}
