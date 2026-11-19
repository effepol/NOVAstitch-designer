// Module e at start (started by module 0, nova/core/modules.ts): the shipped
// presets (fabric/*.json, a refused file does not stop the others), the
// commands e.preset.apply, e.param.reset, e.issue.fix, and module 0's hooks (#54):
//   chooseFabric        Filum's fabric pickers apply the fabric's preset (e.preset.apply, one undo step)
//   objectDefaults      new objects start from the preset in force (the calibration goes on top)
//   registerIssueCheck  module e's warnings in Filum's Issues list

import { runCommand } from "../core/commands";
import { registerFabricChooser } from "../core/fabricChoice";
import { registerIssueCheck } from "../core/issueChecks";
import { registerObjectDefaults } from "../core/objectDefaults";
import { useStore } from "../../store";
import { newObjectDefaults } from "./apply";
import { installPresetCommands } from "./commands";
import { fabricIssues } from "./issues";
import { loadPresets, type PresetError } from "./preset";
import { presetList, presetOf, setPresetList } from "./registry";

let refused: PresetError[] = [];
/** The preset files refused at start, each naming its file and field (e.5). */
export const refusedPresets = (): PresetError[] => refused;

/** The preset files in the program: file name → text. */
function shippedFiles(): Record<string, string> {
  try {
    return import.meta.glob<string>("./fabric/*.json", { eager: true, query: "?raw", import: "default" });
  } catch {
    return {};
  }
}

export function install(files: Record<string, string> = shippedFiles()): () => void {
  const { presets, errors } = loadPresets(files);
  refused = errors;
  for (const e of errors) console.error(`nova: fabric preset refused: ${e.message}`);
  setPresetList(presets);
  const offs = [
    installPresetCommands(),
    registerFabricChooser({
      module: "e",
      // one preset per Filum fabric: picking the fabric applies its preset
      choose(fabric) {
        const p = presetList().find((x) => x.base === fabric);
        if (!p) return false;
        runCommand("e.preset.apply", { presetId: p.id });
        return true;
      },
    }),
    // the preset's values only: module 0 puts Filum's calibration on top
    registerObjectDefaults({ id: "e.preset", module: "e", values: () => newObjectDefaults(useStore.getState().doc, {}) }),
    registerIssueCheck({ id: "e.fabric", module: "e", check: (doc, plan) => fabricIssues(doc, plan, presetOf(doc)) }),
  ];
  return () => offs.forEach((off) => off());
}
