// Module c's settings (contract, section 3: app data, not undoable, never in the
// document): grid.step and target.spacing in mm, cursor.mode, screen.pxPerMm.
// They pass through module 0's prefs.set and are checked first: a wrong value is
// refused and the old one stays. What is shown (target grid on/off, the cursor
// position) is view state, kept here in memory.

import type { Prefs } from "../core/prefs";
import type { Vec2 } from "../../types";

export type CursorMode = "normal" | "crossCanvas" | "crossWindow";
export const CURSOR_MODES: CursorMode[] = ["normal", "crossCanvas", "crossWindow"];

export interface ViewAidsValues {
  "grid.step": number;
  "target.spacing": number;
  "cursor.mode": CursorMode;
  "screen.pxPerMm": number;
}
export type ViewAidsKey = keyof ViewAidsValues;

/** The pointer on the canvas, from module 0's hook (onCanvasPointer). */
export interface ViewCursor {
  tool: string;
  mm: Vec2;
  /** The last point of the path being drawn, or null. */
  last: Vec2 | null;
  /** The same point on the window (CSS px), when the canvas is on screen. */
  client: Vec2 | null;
}

export const DEFAULTS = { "grid.step": 10, "target.spacing": 10, "cursor.mode": "normal" as CursorMode };

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const VALID: Record<ViewAidsKey, (v: unknown) => boolean> = {
  "grid.step": positive,
  "target.spacing": positive,
  "cursor.mode": (v) => (CURSOR_MODES as unknown[]).includes(v),
  "screen.pxPerMm": positive,
};

export interface ViewAids {
  gridStep(): number;
  targetSpacing(): number;
  cursorMode(): CursorMode;
  /** CSS px per mm at 1×: the calibration, else 96/25.4. */
  pxPerMm(): number;
  calibrated(): boolean;
  /** Saved through prefs.set; throws on a wrong value (the old one stays) or if the file cannot be written. */
  set<K extends ViewAidsKey>(key: K, value: ViewAidsValues[K]): Promise<void>;
  /** Resolves once the settings asked for so far are saved (bar buttons ask without waiting). */
  settled(): Promise<void>;
  targetShown(): boolean;
  showTarget(on: boolean): void;
  /** Where the pointer is on the canvas (mm, and CSS px on the window) with the last point drawn; null when it left. */
  cursor(): ViewCursor | null;
  setCursor(c: ViewCursor | null): void;
  /** Called after every change; returns the function that stops listening. */
  onChange(fn: (what: ViewAidsKey | "target" | "cursor") => void): () => void;
}

/** 96 CSS px per inch: the estimate when the screen is not calibrated. */
export const DEFAULT_PX_PER_MM = 96 / 25.4;

export function createViewAids(prefs: Prefs): ViewAids {
  const read = <K extends ViewAidsKey>(key: K): ViewAidsValues[K] | undefined => {
    const v = prefs.get(key);
    return VALID[key](v) ? (v as ViewAidsValues[K]) : undefined;
  };
  const listeners = new Set<(what: ViewAidsKey | "target" | "cursor") => void>();
  const tell = (what: ViewAidsKey | "target" | "cursor") => {
    for (const fn of [...listeners]) {
      try {
        fn(what);
      } catch (e) {
        console.error("nova: module c listener failed", e);
      }
    }
  };
  let pending: Promise<void> = Promise.resolve();
  let target = false;
  let cursor: ViewCursor | null = null;

  return {
    gridStep: () => read("grid.step") ?? DEFAULTS["grid.step"],
    targetSpacing: () => read("target.spacing") ?? DEFAULTS["target.spacing"],
    cursorMode: () => read("cursor.mode") ?? DEFAULTS["cursor.mode"],
    pxPerMm: () => read("screen.pxPerMm") ?? DEFAULT_PX_PER_MM,
    calibrated: () => read("screen.pxPerMm") !== undefined,
    set(key, value) {
      if (!VALID[key](value)) return Promise.reject(new Error(`module c: ${key} = ${JSON.stringify(value)} is not a valid value`));
      const job = pending.catch(() => {}).then(async () => {
        await prefs.set(key, value);
        tell(key);
      });
      pending = job;
      return job;
    },
    settled: () => pending.catch(() => {}),
    targetShown: () => target,
    showTarget(on) {
      if (on === target) return;
      target = on;
      tell("target");
    },
    cursor: () => cursor,
    setCursor(c) {
      cursor = c;
      tell("cursor");
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
