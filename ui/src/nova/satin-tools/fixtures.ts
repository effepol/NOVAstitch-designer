// Module m's test shapes: a lowercase «a» as a font would give it, and its cuts.

import type { DesignObject, SubPath, Vec2 } from "../../types";
import type { Line } from "./split";

export const arc = (c: Vec2, r: number, a0: number, a1: number, n: number): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Vec2;
  });
export const ring = (pts: Vec2[]): SubPath => ({ closed: true, nodes: pts.map((p) => ({ p })) });

// A lowercase «a» (mm, y up): the stem on the right (x 8–10), the arch on top
// (a half ring round (6, 9)), the belly (a ring round (6, 3.5)) joined to the
// stem, its counter reaching almost to the stem (as in a typeface).
const BOWL_A = (Math.acos(2 / 3.5) * 180) / Math.PI; // where the belly meets the stem's left edge
export const A_OUT: Vec2[] = [
  [10, 0],
  [10, 9],
  ...arc([6, 9], 4, 0, 160, 32).slice(1),
  ...arc([6, 9], 2, 160, 0, 24),
  ...arc([6, 3.5], 3.5, BOWL_A, 360 - BOWL_A, 64),
  [8, 0],
];
export const A_HOLE: Vec2[] = arc([6, 3.5], 1.8, 0, 360, 48).slice(0, -1);
/** The «a» as an imported fill. */
export const letterA = (): DesignObject => ({
  id: "a",
  name: "a",
  thread: "T1",
  visible: true,
  locked: false,
  paths: [ring(A_OUT), ring(A_HOLE)],
  stitch: { type: "fill", method: "tatami", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, underlay: true } as DesignObject["stitch"],
  trimAfter: false,
  stopAfter: false,
});
// two cuts between belly and stem: from the counter out to the notches above and below the belly
export const A_CUTS: Line[] = [
  [
    [7.0, 4.6],
    [7.6, 7.3],
  ],
  [
    [7.0, 2.4],
    [7.6, -0.3],
  ],
];

