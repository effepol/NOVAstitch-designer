// Fabric choice hook (module 0, for module e): store.setFabric, and so every
// fabric picker of Filum (the title bar, the Material panel), calls
// chooseFabric, so a module can run the change as its command
// (e.preset.apply: the preset of that fabric, in one undo step).
// Without a chooser, or when it declines, Filum's own change runs as before.

import type { Fabric } from "../../types";

export interface FabricChooser {
  module: string;
  /** Applies the choice (as one undo step); false: not handled, Filum's change runs. */
  choose(fabric: Fabric): boolean;
}

let chooser: FabricChooser | null = null;

export function registerFabricChooser(c: FabricChooser): () => void {
  if (chooser) throw new Error(`Fabric chooser from module "${c.module}": module "${chooser.module}" has registered one already`);
  chooser = c;
  return () => {
    if (chooser === c) chooser = null;
  };
}

/** Change the design's fabric: through the module's command, else `fallback` (Filum's own commit). */
export function chooseFabric(fabric: Fabric, fallback: () => void): void {
  if (!chooser?.choose(fabric)) fallback();
}
