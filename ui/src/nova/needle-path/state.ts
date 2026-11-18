// Module d's settings as the app holds them: read once from the app's settings
// (module 0's prefs), changed through it, and the canvas is redrawn on a change.

import { redrawCanvas } from "../core/registry";
import type { Prefs } from "../core/prefs";
import { DEFAULTS, PREF_KEYS, settingsFrom, type NeedlePathSettings } from "./settings";

let current: NeedlePathSettings = { ...DEFAULTS };

/** The settings in force (the defaults until they are read). */
export const needlePathSettings = (): NeedlePathSettings => current;

export function loadNeedlePathSettings(p: { get(key: string): unknown }): NeedlePathSettings {
  current = settingsFrom((k) => p.get(k));
  return current;
}

/** Save one setting; the old value stays if the file cannot be written. */
export async function setNeedlePathSetting<K extends keyof NeedlePathSettings>(p: Pick<Prefs, "get" | "set">, key: K, value: NeedlePathSettings[K]): Promise<void> {
  await p.set(PREF_KEYS[key], value);
  loadNeedlePathSettings(p);
  redrawCanvas();
}
