// Module d's app settings (contract, section 3: prefs of module 0, never in the
// document): needlePath.enabled, needlePath.widthPx, needlePath.dots.

export interface NeedlePathSettings {
  /** The «needle path» option of the stitch view. */
  enabled: boolean;
  /** Width of the line in screen pixels, the same at every zoom. */
  widthPx: number;
  /** A dot on every penetration, at every zoom. */
  dots: boolean;
}

export const DEFAULTS: NeedlePathSettings = { enabled: false, widthPx: 1, dots: false };

export const PREF_KEYS = { enabled: "needlePath.enabled", widthPx: "needlePath.widthPx", dots: "needlePath.dots" } as const;

/** Narrowest and widest line accepted (px). */
export const WIDTH_MIN = 0.5;
export const WIDTH_MAX = 8;

/** The settings from the stored values; anything missing or wrong gets its default. */
export function settingsFrom(get: (key: string) => unknown): NeedlePathSettings {
  const enabled = get(PREF_KEYS.enabled);
  const widthPx = get(PREF_KEYS.widthPx);
  const dots = get(PREF_KEYS.dots);
  return {
    enabled: typeof enabled === "boolean" ? enabled : DEFAULTS.enabled,
    widthPx: typeof widthPx === "number" && Number.isFinite(widthPx) ? Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, widthPx)) : DEFAULTS.widthPx,
    dots: typeof dots === "boolean" ? dots : DEFAULTS.dots,
  };
}
