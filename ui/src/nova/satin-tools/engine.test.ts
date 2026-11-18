// Module m with Filum's engine: the satins made by the two tools are sewn by
// the engine as two-rail satins — stitches across the rails at the angle of
// the rungs, inside the shape.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { emptyDoc } from "../../store";
import type { DesignObject, SatinParams, StitchDocument, SubPath, Vec2 } from "../../types";
import { planSplit, type Line } from "./split";
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

const angleOf = (a: Vec2, b: Vec2) => {
  const x = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return ((x % 180) + 180) % 180;
};
const diff = (x: number, y: number) => Math.min(Math.abs(x - y), 180 - Math.abs(x - y));
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

// «Dividi e dirigi» on the A: the stitches of each part follow its line
const DIRS: Line[] = [
  [
    [6, 11],
    [6, 14],
  ],
  [
    [0.5, 2],
    [3, 2],
  ],
  [
    [11.5, 2],
    [9, 2],
  ],
];
const split = planSplit(base, {
  id: "A",
  cuts: [
    [
      [-1, 7],
      [13, 7],
    ],
    [
      [6, -1],
      [6, 6],
    ],
  ],
  directions: DIRS,
})!;
const d = { ...split.doc, objects: split.doc.objects.map(bare) };
const p = plan(d);
check(p.coords.length > 100, `the engine sews the three satins (${p.coords.length / 2} stitches)`);
d.objects.forEach((o, k) => {
  const segs = segments(p, k);
  // the part's own line: the one inside it
  const want = DIRS.map((l) => angleOf(l[0], l[1])).find((_, i) => {
    const m: Vec2 = [(DIRS[i][0][0] + DIRS[i][1][0]) / 2, (DIRS[i][0][1] + DIRS[i][1][1]) / 2];
    return inside([[...o.paths[0].nodes.map((n) => n.p), ...o.paths[1].nodes.map((n) => n.p).reverse()]], m);
  });
  // a satin zig-zags: of two stitches in a row one lies on a rung, the other leans to step on
  // (stitches under 0.5 mm, at a pointed end, have no direction to speak of)
  const dev = segs.map(([a, b]) => (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5 ? 0 : diff(angleOf(a, b), want ?? 0)));
  let worst = 0;
  for (let i = 0; i + 1 < dev.length; i++) worst = Math.max(worst, Math.min(dev[i], dev[i + 1]));
  check(want !== undefined && segs.length > 20 && worst < 0.5, `${o.name}: ${segs.length} stitches; of every two in a row one is at the line's ${want}° (worst ${worst.toFixed(3)}°)`);
});
const pts: Vec2[] = [];
for (let i = 0; i < p.objects.length; i++) if (p.flags[i] === 0) pts.push([p.coords[2 * i], p.coords[2 * i + 1]]);
const out = pts.filter((q) => !inside([A_OUT, A_HOLE], q) && !nearEdge([A_OUT, A_HOLE], q, 0.15));
check(pts.length > 100 && out.length === 0, `every needle point is inside the A (${out.length} outside)`);

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
