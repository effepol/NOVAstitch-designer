// Module b, part 2: the view options «Start and end» and «Connections».
// Off by default; remembered between sessions in the app's settings (module 0's
// prefs, nova-prefs.json), never in the document.

import type { Prefs } from "../core/prefs";
import { redrawCanvas } from "../core/registry";

export type ViewOption = "startEnd" | "links";
export const PREF_KEY: Record<ViewOption, string> = { startEnd: "b.view.startEnd", links: "b.view.links" };

const state: Record<ViewOption, boolean> = { startEnd: false, links: false };
let store: Prefs | null = null;
const listeners = new Set<() => void>();

export const isOn = (o: ViewOption): boolean => state[o];

/** Reads the saved options (at start, once the settings are open). */
export function loadViewOptions(p: Prefs): void {
  store = p;
  for (const o of Object.keys(state) as ViewOption[]) state[o] = p.get<boolean>(PREF_KEY[o]) === true;
  changed();
}

/** Turns an option on or off, redraws, and saves it (a failed save keeps the option for this session). */
export async function setOption(o: ViewOption, on: boolean): Promise<void> {
  if (state[o] === on) return;
  state[o] = on;
  changed();
  try {
    await store?.set(PREF_KEY[o], on);
  } catch (e) {
    console.error(`nova: the view option ${o} was not saved`, e);
  }
}

export const toggleOption = (o: ViewOption) => setOption(o, !state[o]);

export function onViewOptions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  redrawCanvas();
  for (const fn of [...listeners]) fn();
}
