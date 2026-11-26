// Module n (varieties) starts here: module 0 finds this file and calls install() once.
// The library (the program's files and the user's folder «varieta/»), the command
// n.variety.set (one undo step, fields recorded in nova.edited) and the «Varietà»
// fields in Filum's tatami and satin sections (module 0's hook registerStitchFields).

import { registerCommand } from "../core/commands";
import { registerStitchFields } from "../core/stitchTypes";
import { reloadVarieties, setSources, shippedFiles, tauriFolderReader } from "./load";
import { SET_COMMAND, VarietyFields } from "./Panel";
import { applyVariety, type SetParams } from "./varieties";
import "./texts";
import it from "./it.json";
import en from "./en.json";

/** Module n's registrations; returns the function that removes them. */
export function installVarieties(): () => void {
  const offs = [
    registerCommand<SetParams>({ id: SET_COMMAND, label: { it: it["n.command.set"], en: en["n.command.set"] }, apply: applyVariety }),
    registerStitchFields({ id: "n.fill", module: "n", type: "fill", Fields: VarietyFields }),
    registerStitchFields({ id: "n.satin", module: "n", type: "satin", Fields: VarietyFields }),
  ];
  return () => offs.forEach((off) => off());
}

export function install(): Promise<void> {
  setSources(shippedFiles(), tauriFolderReader());
  installVarieties();
  return reloadVarieties();
}
