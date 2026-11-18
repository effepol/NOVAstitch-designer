// User preferences that outlive a design: look, hints, nudging, autosave.
// The view toggles (grid, guides, …) are remembered by the store itself.
import { safeSetItem } from "./storage";
import { t } from "../nova/i18n/filum";

export interface Prefs {
  /** Highlight colour of the interface (hex). */
  accent: string;
  /** Contextual shortcut hints along the bottom. */
  hints: boolean;
  /** Arrow keys move objects by this much (mm), with Shift by `nudgeBig`. */
  nudge: number;
  nudgeBig: number;
  /** Arrow keys move selected points (node tool). */
  nodeNudge: number;
  nodeNudgeBig: number;
  /** Keep the design in the browser storage while working. */
  autosave: boolean;
  /** New points (pen, node tool) snap to existing points. */
  snapPoints: boolean;
}

/** The app colour: NOVAstitch Designer's red (the icon's background, 18/11). */
export const APP_COLOR = "#CC1219";

export const DEFAULT_PREFS: Prefs = {
  accent: APP_COLOR,
  hints: true,
  nudge: 0.5,
  nudgeBig: 5,
  nodeNudge: 0.1,
  nodeNudgeBig: 1,
  autosave: true,
  snapPoints: true,
};

export const ACCENTS: { color: string; label: string }[] = [
  { color: APP_COLOR, get label() { return t("filum.finestre.filum_violet"); } },
  { color: "#b3203a", get label() { return t("filum.finestre.crimson"); } },
  { color: "#d9480f", get label() { return t("filum.finestre.orange"); } },
  { color: "#0f8a7e", get label() { return t("filum.finestre.teal"); } },
  { color: "#2b8a3e", get label() { return t("filum.finestre.green"); } },
  { color: "#1971c2", get label() { return t("filum.finestre.blue"); } },
  { color: "#c2255c", get label() { return t("filum.finestre.raspberry"); } },
  { color: "#495057", get label() { return t("filum.finestre.graphite"); } },
];

const KEY = "filum.prefs";

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  safeSetItem(KEY, JSON.stringify(p));
}

const rgb = (hex: string) => {
  const v = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const hex = (c: number[]) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
/** a + (b − a)·t */
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};

/** The red accent's own text colours, as styles.css has them (contract, «Aspetto rosso», 18/11). */
const APP_TEXT = { light: "#B30F16", dark: "#FF7A7F" };

/**
 * The interface colours from one accent: buttons, highlights and accent text.
 * The canvas selection does not follow the accent any more (it is a fixed blue
 * in styles.css): with a red accent it would vanish on red threads.
 */
export function accentTokens(accent: string, theme: "light" | "dark"): Record<string, string> {
  const [r, g, b] = rgb(accent);
  const own = accent.toLowerCase() === APP_COLOR.toLowerCase();
  if (theme === "dark")
    return {
      "--accent": mix(accent, "#ffffff", 0.12),
      "--accent-hover": accent,
      "--accent-soft": `rgba(${r}, ${g}, ${b}, 0.2)`,
      "--accent-text": own ? APP_TEXT.dark : mix(accent, "#ffffff", 0.45),
      "--accent-fg": "#ffffff",
    };
  return {
    "--accent": accent,
    "--accent-hover": mix(accent, "#000000", 0.14),
    "--accent-soft": `rgba(${r}, ${g}, ${b}, 0.1)`,
    "--accent-text": own ? APP_TEXT.light : mix(accent, "#000000", 0.12),
    "--accent-fg": "#ffffff",
  };
}

/** Apply the accent's colours to the interface. */
export function applyAccent(accent: string, theme: "light" | "dark") {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(accentTokens(accent, theme))) s.setProperty(k, v);
  // an older session may have set the selection: it is the stylesheet's fixed blue now
  s.removeProperty("--select");
}
