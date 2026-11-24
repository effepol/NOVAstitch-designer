// Spaces a module can fill (module 0, for modules e and l): Filum's fabric panel
// (components/MaterialPanel.tsx, under the fabric picker), the export
// dialog (components/ExportDialog.tsx, in the settings column) and every
// thread of the thread panel (components/ThreadManager.tsx). Each
// registered component is drawn in a box marked data-nova; with nothing
// registered nothing changes. Texts come from the registering module.

import { useSyncExternalStore, type ComponentType } from "react";
import type { Thread } from "../../types";

export interface SlotProps {
  material: Record<string, never>;
  /** The export format chosen in the dialog (e.g. "dst", "pes", "png"). */
  export: { format: string };
  /** On every thread of Filum's thread panel (Thread colours): the thread of that row. */
  thread: { thread: Thread };
}
export type SlotName = keyof SlotProps;

export interface SlotEntry<S extends SlotName = SlotName> {
  /** "<module>.<name>" */
  id: string;
  module: string;
  slot: S;
  Component: ComponentType<SlotProps[S]>;
}

const entries = new Map<string, SlotEntry>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  for (const fn of [...listeners]) fn();
};

export function registerSlot<S extends SlotName>(e: SlotEntry<S>): () => void {
  if (entries.has(e.id)) throw new Error(`Slot entry "${e.id}" from module "${e.module}" is already registered`);
  entries.set(e.id, e as unknown as SlotEntry);
  changed();
  return () => {
    if (entries.get(e.id) === (e as unknown)) {
      entries.delete(e.id);
      changed();
    }
  };
}

export const slotEntries = <S extends SlotName>(slot: S): SlotEntry<S>[] => [...entries.values()].filter((e) => e.slot === slot) as unknown as SlotEntry<S>[];

/** React: render again when entries come or go. */
export function useSlots(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => version,
  );
}
