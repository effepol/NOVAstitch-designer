// Module f: the patch commands of the contract, each a pure function run only
// through runCommand (one command = one undo step).

import { registerCommand, type Command } from "../core/commands";
import { centerPatch, createPatch, setColorGrouping, setOrder } from "./patch";

export const PATCH_COMMANDS = [
  { id: "f.patch.create", label: { it: "Crea patch", en: "Create patch" }, apply: createPatch },
  { id: "f.patch.setOrder", label: { it: "Ordine dei pezzi", en: "Order of the pieces" }, apply: setOrder },
  { id: "f.patch.setColorGrouping", label: { it: "Raggruppamento colori", en: "Colour grouping" }, apply: setColorGrouping },
  { id: "f.patch.center", label: { it: "Centra il patch nel telaio", en: "Centre the patch in the hoop" }, apply: centerPatch },
] as unknown as Command<never>[];

/** Registers module f's patch commands; returns the function that removes them. */
export function registerPatchCommands(): () => void {
  const offs = PATCH_COMMANDS.map((c) => registerCommand(c));
  return () => offs.forEach((off) => off());
}
