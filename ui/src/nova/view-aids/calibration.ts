// Module c, the screen's calibration (not the fabric's, which is Filum's
// lib/calibration.ts): a line of known pixels is measured with a real ruler on
// the screen where the design is. One calibration only, also with two screens.

import { emit } from "../core/events";
import type { ViewAids } from "./settings";

declare module "../core/events" {
  interface NovaEvents {
    /** The screen was calibrated: CSS px per mm at 1×. */
    "screen.calibrated": { pxPerMm: number };
  }
}

/** Plausible screens: from about 25 to about 1000 dots per inch. */
const MIN = 1;
const MAX = 40;

/** CSS px per mm from a line of `linePx` CSS px measured `measuredMm` mm; throws on a value that cannot be. */
export function pxPerMmFrom(linePx: number, measuredMm: number): number {
  if (!(Number.isFinite(linePx) && linePx > 0 && Number.isFinite(measuredMm) && measuredMm > 0)) throw new Error("module c: the line and the measure must be greater than zero");
  const v = linePx / measuredMm;
  if (v < MIN || v > MAX) throw new Error(`module c: ${v.toFixed(3)} px/mm is not a screen`);
  return v;
}

/** Saves the calibration (screen.pxPerMm) and says so (screen.calibrated). */
export async function calibrateScreen(aids: Pick<ViewAids, "set">, linePx: number, measuredMm: number): Promise<number> {
  const pxPerMm = pxPerMmFrom(linePx, measuredMm);
  await aids.set("screen.pxPerMm", pxPerMm);
  emit("screen.calibrated", { pxPerMm });
  return pxPerMm;
}
