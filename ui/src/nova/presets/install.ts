// Module e at start (started by module 0, nova/core/modules.ts): the shipped
// presets (fabric/*.json, a refused file does not stop the others), and the
// commands e.preset.apply, e.param.reset, e.issue.fix.
// The hooks into Filum (fabric picker, new objects' values, issue registry)
// come with module 0's PR; until then nothing here changes the interface.

import { installPresetCommands } from "./commands";
import { loadPresets, type PresetError } from "./preset";
import { setPresetList } from "./registry";

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
  return installPresetCommands();
}
