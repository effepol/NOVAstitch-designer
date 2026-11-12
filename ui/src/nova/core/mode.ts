// The current mode, as module h decides it. Module 0 only reads it: until a
// source is set (module h, or a test) the app is in Studio.

import type { NovaMode } from "../../types";

let source: (() => NovaMode) | null = null;

/** Module h tells where the current mode comes from; null goes back to Studio. */
export function setModeSource(fn: (() => NovaMode) | null): void {
  source = fn;
}

export const currentMode = (): NovaMode => source?.() ?? "studio";
