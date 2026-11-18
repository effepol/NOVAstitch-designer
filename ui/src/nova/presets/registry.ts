// The fabric presets loaded at start (module e), and the one in force in a design.

import type { StitchDocument } from "../../types";
import type { FabricPreset } from "./preset";

let list: FabricPreset[] = [];
const listeners = new Set<() => void>();

/** The presets the app offers (install.ts sets them at start; tests set their own). */
export function setPresetList(presets: FabricPreset[]): void {
  list = [...presets];
  for (const fn of [...listeners]) fn();
}

export const presetList = (): FabricPreset[] => list;
export const presetById = (id: string | null | undefined): FabricPreset | null => (id ? (list.find((p) => p.id === id) ?? null) : null);
/** The preset in force in `doc` (nova.fabricPreset), null when none or not among the loaded ones. */
export const presetOf = (doc: StitchDocument): FabricPreset | null => presetById(doc.nova?.fabricPreset?.id);

export function onPresetList(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
