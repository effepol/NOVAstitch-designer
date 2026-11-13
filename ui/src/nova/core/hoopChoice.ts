// Hoop choice hook (module 0, for module a): every place where Filum changes
// the design's hoop calls chooseHoop, so a module can run it as its command
// (a.hoop.select, a.hoop.custom) and keep nova.hoopRef and nova.hoopKind right.
// Without a chooser, or when it declines, Filum's own change runs as before.
// Modules also add groups of hoops (the user's list) to Filum's hoop pickers.

import { useSyncExternalStore } from "react";
import type { Hoop, StitchDocument } from "../../types";

/** Preset ids: "hoops:<name>" (lib/hoops.ts), "machine:<machine id>/<frame id>" (lib/machines.ts). */
export type HoopChoice = { source: "preset"; id: string } | { source: "user"; id: string } | { source: "custom"; hoop: Hoop };

export interface HoopChooser {
  module: string;
  /** Applies the choice (as one undo step); false: not handled, Filum's change runs. */
  choose(c: HoopChoice): boolean;
  /** The same choice on a design not open yet (a new design): a pure function; null: not handled. */
  apply?(doc: StitchDocument, c: HoopChoice): StitchDocument | null;
}

let chooser: HoopChooser | null = null;

export function registerHoopChooser(c: HoopChooser): () => void {
  if (chooser) throw new Error(`Hoop chooser from module "${c.module}": module "${chooser.module}" has registered one already`);
  chooser = c;
  return () => {
    if (chooser === c) chooser = null;
  };
}

/** Change the design's hoop: through the module's command, else `fallback` (Filum's own commit). */
export function chooseHoop(c: HoopChoice, fallback: () => void): void {
  if (!chooser?.choose(c)) fallback();
}

/** The hoop of a design not open yet (a new design): the module's result, else `fallback` (Filum's own). No undo step. */
export function withHoop(doc: StitchDocument, c: HoopChoice, fallback: (doc: StitchDocument) => StitchDocument): StitchDocument {
  return chooser?.apply?.(doc, c) ?? fallback(doc);
}

export interface HoopGroupEntry {
  /** "<module>.<name>" */
  id: string;
  module: string;
  /** t() key of the group's title in the pickers. */
  label: string;
  list(): { id: string; name: string; width: number; height: number; shape?: Hoop["shape"] }[];
}

const groups = new Map<string, HoopGroupEntry>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  for (const fn of [...listeners]) fn();
};

export function registerHoopGroup(g: HoopGroupEntry): () => void {
  if (groups.has(g.id)) throw new Error(`Hoop group "${g.id}" from module "${g.module}" is already registered`);
  groups.set(g.id, g);
  changed();
  return () => {
    if (groups.get(g.id) === g) {
      groups.delete(g.id);
      changed();
    }
  };
}

export const hoopGroups = (): HoopGroupEntry[] => [...groups.values()];

/** A group's list changed (the user added a hoop): the pickers render again. */
export const hoopGroupsChanged = changed;

/** React: re-render the pickers when the groups or their lists change. */
export function useHoopGroups(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
