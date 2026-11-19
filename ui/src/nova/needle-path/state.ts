// Module d's settings as the app holds them: read once from the app's settings
// (module 0's prefs, nova-prefs.json, never the document); a change is in force
// at once, redraws the canvas and is saved (a failed save keeps it for this session).

import { redrawCanvas } from "../core/registry";
import type { Prefs } from "../core/prefs";
import { DEFAULTS, PREF_KEYS, settingsFrom, type NeedlePathSettings } from "./settings";

let current: NeedlePathSettings = { ...DEFAULTS };
let store: Pick<Prefs, "set"> | null = null;
const listeners = new Set<() => void>();

/** The settings in force (the defaults until they are read). */
export const needlePathSettings = (): NeedlePathSettings => current;

/** Reads the saved settings (at start, once the settings are open); later changes are saved there. */
export function loadNeedlePathSettings(p: { get(key: string): unknown; set?: Prefs["set"] }): NeedlePathSettings {
  current = settingsFrom((k) => p.get(k));
  store = p.set ? (p as Pick<Prefs, "set">) : null;
  changed();
  return current;
}

/** Change one setting: in force and drawn at once, then saved. */
export async function setNeedlePathSetting<K extends keyof NeedlePathSettings>(key: K, value: NeedlePathSettings[K]): Promise<void> {
  // the same checks as a value read from the file (a width out of range is brought in)
  const values: Record<string, unknown> = { [PREF_KEYS.enabled]: current.enabled, [PREF_KEYS.widthPx]: current.widthPx, [PREF_KEYS.dots]: current.dots, [PREF_KEYS[key]]: value };
  const next = settingsFrom((k) => values[k]);
  if (next[key] === current[key]) return;
  current = next;
  changed();
  try {
    await store?.set(PREF_KEYS[key], next[key]);
  } catch (e) {
    console.error(`nova: the needle path setting ${key} was not saved`, e);
  }
}

export function onNeedlePathSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  redrawCanvas();
  for (const fn of [...listeners]) fn();
}
