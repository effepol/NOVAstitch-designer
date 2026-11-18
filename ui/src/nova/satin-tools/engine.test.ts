// Module m with Filum's engine: the two-rail satin is sewn by the engine
// between its rails, stitches across the column.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { emptyDoc } from "../../store";
import type { DesignObject, SatinParams, StitchDocument, SubPath, Vec2 } from "../../types";
import { satinFromClicks } from "./twoRails";

initSync({ module: readFileSync(path.join(process.cwd(), "src", "wasm", "pkg", "filum_wasm_bg.wasm")) });
const engine = new StitchEngine();
type Plan = { coords: Float32Array; flags: Uint8Array; objects: Uint32Array };
const plan = (d: StitchDocument) => engine.plan(JSON.stringify(d)) as Plan;

const ring = (pts: Vec2[]): SubPath => ({ closed: true, nodes: pts.map((p) => ({ p })) });
const A_OUT: Vec2[] = [
  [0, 0],
  [3, 0],
  [3.9, 3],
  [8.1, 3],
  [9, 0],
  [12, 0],
  [7.5, 15],
  [4.5, 15],
];
const A_HOLE: Vec2[] = [
  [4.5, 5],
  [6, 10],
  [7.5, 5],
];
const A: DesignObject = {
  id: "A",
  name: "A",
  thread: "T1",
  visible: true,
  locked: false,
  paths: [ring(A_OUT), ring(A_HOLE)],
  stitch: { type: "fill", method: "tatami", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, underlay: true } as DesignObject["stitch"],
  trimAfter: false,
  stopAfter: false,
};
const base: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects: [A] };

/** Only the top stitches: no underlay, no pull compensation, no long-stitch splitting. */
const bare = (o: DesignObject): DesignObject =>
  o.stitch.type === "satin"
    ? { ...o, stitch: { ...o.stitch, centerWalk: false, contourUnderlay: false, zigzagUnderlay: false, underlayAuto: false, pullComp: 0, pullCompPct: 0, maxStitchLength: 50 } as DesignObject["stitch"] & SatinParams }
    : o;

function inside(rings: Vec2[][], q: Vec2): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = [r[i], r[j]];
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  return c;
}
const nearEdge = (rings: Vec2[][], q: Vec2, tol: number) =>
  rings.some((r) =>
    r.some((a, i) => {
      const b = r[(i + 1) % r.length];
      const e: Vec2 = [b[0] - a[0], b[1] - a[1]];
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * e[0] + (q[1] - a[1]) * e[1]) / (e[0] * e[0] + e[1] * e[1])));
      return Math.hypot(a[0] + e[0] * t - q[0], a[1] + e[1] * t - q[1]) <= tol;
    }),
  );

/** Stitch segments of object k (no jumps), as point pairs. */
function segments(p: Plan, k: number): [Vec2, Vec2][] {
  const out: [Vec2, Vec2][] = [];
  for (let i = 1; i < p.objects.length; i++) {
    if (p.objects[i] !== k || p.objects[i - 1] !== k || p.flags[i] !== 0) continue;
    out.push([
      [p.coords[2 * i - 2], p.coords[2 * i - 1]],
      [p.coords[2 * i], p.coords[2 * i + 1]],
    ]);
  }
  return out;
}

// «Satin a due binari»: a column sewn between the clicked rails
const two = satinFromClicks({ ...emptyDoc(), threads: base.threads }, {
  left: [
    [10, 10],
    [8, 40],
  ],
  right: [
    [20, 12],
    [30, 38],
  ],
});
const p2 = plan({ ...two, objects: two.objects.map(bare) });
const s2 = segments(p2, 0).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 1);
const quad: Vec2[] = [
  [10, 10],
  [20, 12],
  [30, 38],
  [8, 40],
];
check(s2.length > 20 && s2.every(([a, b]) => [a, b].every((q) => inside([quad], q) || nearEdge([quad], q, 0.15))), `the two-rail satin is sewn between its rails (${s2.length} stitches)`);
check(s2.every(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 25), "its stitches go across the column, not along it");

done("module m — with the engine");
