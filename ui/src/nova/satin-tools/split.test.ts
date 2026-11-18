// Module m — «Dividi e dirigi»: tests m.4, m.5 and m.6 (contract, section 4)
// on the command m.split.apply run through runCommand, plus the overlap of
// the fabric preset and the cut limited to the drawn segment.

import { check, done } from "../core/testkit";
import { useStore, emptyDoc } from "../../store";
import type { DesignObject, StitchDocument, SubPath, Vec2 } from "../../types";
import { runCommand } from "../core/commands";
import { isRailSatin, railMap } from "../../lib/nodeOps";
import { parsePreset } from "../presets/preset";
import { setPresetList } from "../presets/registry";
import { registerSatinToolCommands } from "./commands";
import { planSplit, splitWarnings, type Line } from "./split";

const s = () => useStore.getState();
const doc = () => s().doc;
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const off = registerSatinToolCommands();

const ring = (pts: Vec2[]): SubPath => ({ closed: true, nodes: pts.map((p) => ({ p })) });
function fill(id: string, paths: SubPath[]): DesignObject {
  return {
    id,
    name: id,
    thread: "T1",
    visible: true,
    locked: false,
    paths,
    stitch: { type: "fill", method: "tatami", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, underlay: true } as DesignObject["stitch"],
    trimAfter: false,
    stopAfter: false,
  };
}
function start(objects: DesignObject[], nova?: StitchDocument["nova"]): StitchDocument {
  const d: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects, ...(nova ? { nova } : {}) };
  s().setDoc(d);
  return d;
}

// An imported «A» (mm): legs 3 mm wide, a crossbar from y 3 to 5, the counter
// (hole) above the crossbar up to y 10, a flat top at y 15.
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
const A = () => fill("A", [ring(A_OUT), ring(A_HOLE)]);

// Two cuts: one across the counter (both legs), one down the crossbar only.
const CUT1: Line = [
  [-1, 7],
  [13, 7],
];
const CUT2: Line = [
  [6, -1],
  [6, 6],
];
// Three direction lines: vertical on the top, horizontal on each leg.
const DIR_TOP: Line = [
  [6, 11],
  [6, 14],
];
const DIR_LEFT: Line = [
  [0.5, 2],
  [3, 2],
];
const DIR_RIGHT: Line = [
  [11.5, 2],
  [9, 2],
];

/** Even-odd inside test on rings. */
function inside(rings: Vec2[][], q: Vec2): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = [r[i], r[j]];
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  return c;
}
/** A two-rail satin's outline: rail 1 then rail 2 backwards. */
const outline = (o: DesignObject): Vec2[] => [...o.paths[0].nodes.map((n) => n.p), ...o.paths[1].nodes.map((n) => n.p).reverse()];
const angleOf = (a: Vec2, b: Vec2) => {
  const x = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return ((x % 180) + 180) % 180;
};
const sameAngle = (x: number, y: number, e = 0.01) => Math.min(Math.abs(x - y), 180 - Math.abs(x - y)) < e;
/** Angles of all rungs (node pairs) of a two-rail satin. */
function rungAngles(o: DesignObject): number[] {
  const m = railMap(o.paths[0], o.paths[1]);
  if (!m) return [];
  return o.paths[0].nodes.map((n, i) => angleOf(n.p, o.paths[1].nodes[m.at(i)].p));
}
const bounds = (o: DesignObject) => {
  const ps = o.paths.flatMap((sp) => sp.nodes.map((n) => n.p));
  return { x0: Math.min(...ps.map((p) => p[0])), x1: Math.max(...ps.map((p) => p[0])), y0: Math.min(...ps.map((p) => p[1])), y1: Math.max(...ps.map((p) => p[1])) };
};

// --- m.4 -------------------------------------------------------------------
start([fill("before", [ring([[50, 50], [52, 50], [52, 52]])]), A(), fill("after", [ring([[60, 60], [62, 60], [62, 62]])])]);
const plan = planSplit(doc(), { id: "A", cuts: [CUT1, CUT2], directions: [DIR_TOP, DIR_LEFT, DIR_RIGHT] });
check(!!plan && plan.overlap === 0.2, "m.4: no preset, the parts overlap 0.2 mm");
check(!!plan && plan.auto.length === 0, "m.4: every part has its direction line");
runCommand("m.split.apply", { id: "A", cuts: [CUT1, CUT2], directions: [DIR_TOP, DIR_LEFT, DIR_RIGHT] });
const made = doc().objects.filter((o) => o.id !== "before" && o.id !== "after");
check(made.length === 3, `m.4: three satins (${made.length})`);
check(made.every((o) => o.stitch.type === "satin" && isRailSatin(o)), "m.4: every part is a two-rail satin of Filum");
check(!doc().objects.some((o) => o.id === "A"), "m.4: the original A is replaced");
check(doc().objects[0].id === "before" && doc().objects[4].id === "after", "m.4: the satins take the A's place in the sewing order");
check(made.every((o) => o.thread === "T1"), "m.4: the satins keep the A's thread");
check(made.every((o) => o.stitch.type === "satin" && o.stitch.reverseRails === "none" && !o.stitch.guides?.length), "m.4: the node pairs are the rungs (rails never reversed)");

// which part is which: the one holding each direction line's middle
const holding = (l: Line) => made.find((o) => inside([outline(o)], [(l[0][0] + l[1][0]) / 2, (l[0][1] + l[1][1]) / 2]));
const top = holding(DIR_TOP);
const left = holding(DIR_LEFT);
const right = holding(DIR_RIGHT);
check(!!top && !!left && !!right && new Set([top, left, right]).size === 3, "m.4: each direction line lies in its own part");
for (const [o, l, name] of [
  [top, DIR_TOP, "top"],
  [left, DIR_LEFT, "left leg"],
  [right, DIR_RIGHT, "right leg"],
] as const) {
  const want = angleOf(l[0], l[1]);
  const got = o ? rungAngles(o) : [];
  check(got.length >= 2 && got.every((a) => sameAngle(a, want)), `m.4: ${name}: every rung at the line's angle ${want.toFixed(1)}° (${got.map((a) => a.toFixed(2)).join(", ")})`);
}

// no gap: every point of the A is inside at least one satin
let gaps = 0;
let tried = 0;
for (let x = 0.0123; x < 12; x += 0.25)
  for (let y = 0.0171; y < 15; y += 0.25) {
    if (!inside([A_OUT, A_HOLE], [x, y])) continue;
    tried++;
    if (!made.some((o) => inside([outline(o)], [x, y]))) gaps++;
  }
check(tried > 500 && gaps === 0, `m.4: no gap between the parts (${gaps} of ${tried} points uncovered)`);
// nothing outside: no satin covers the counter or the space under the crossbar
let spill = 0;
for (const q of [
  [6, 7.5],
  [6, 9],
  [5.2, 6],
  [6.8, 6],
  [6, 1.5],
  [4.5, 1],
  [-0.5, 1],
  [12.5, 1],
  [6, 15.5],
] as Vec2[])
  if (made.some((o) => inside([outline(o)], q))) spill++;
check(spill === 0, "m.4: the satins stay inside the A (counter and the gap between the legs stay empty)");

// overlap at the cuts: each side passes the cut by half of 0.2 mm
check(!!top && near(bounds(top).y0, 6.9, 1e-4), "m.4: the top passes cut 1 by 0.1 mm");
check(!!left && near(bounds(left).y1, 7.1, 1e-4) && !!right && near(bounds(right).y1, 7.1, 1e-4), "m.4: the legs pass cut 1 by 0.1 mm");
check(!!left && near(bounds(left).x1, 6.1, 1e-4) && !!right && near(bounds(right).x0, 5.9, 1e-4), "m.4: the crossbar halves pass cut 2 by 0.1 mm each (0.2 mm overlap)");
// cut 2 is drawn only up to y 6: it does not split the top, which the infinite line would
check(!!top && bounds(top).x0 < 3 && bounds(top).x1 > 9, "m.4: cut 2 stops where it is drawn (the top stays whole)");

// --- m.5 -------------------------------------------------------------------
s().undo();
check(doc().objects.length === 3 && doc().objects[1].id === "A" && JSON.stringify(doc().objects[1]) === JSON.stringify(A()), "m.5: one Annulla brings back the original A");

// --- m.6 -------------------------------------------------------------------
// A bar 20 × 4 mm turned by 30°: no direction line → stitches across the long side
const turn = (p: Vec2): Vec2 => {
  const c = Math.cos(Math.PI / 6);
  const sn = Math.sin(Math.PI / 6);
  return [10 + p[0] * c - p[1] * sn, 10 + p[0] * sn + p[1] * c];
};
const bar = () => fill("bar", [ring(([[0, 0], [20, 0], [20, 4], [0, 4]] as Vec2[]).map(turn))]);
start([bar()]);
const p6 = planSplit(doc(), { id: "bar", cuts: [], directions: [] });
check(!!p6 && p6.auto.length === 1, "m.6: the part without a line gets the automatic direction");
check(splitWarnings(p6!, "studio").includes("m.split.autoDirection"), "m.6: Studio warns about it");
check(splitWarnings(p6!, "assisted").length === 0, "m.6: Assisted does not (there the direction is always automatic)");
runCommand("m.split.apply", { id: "bar", cuts: [], directions: [] });
const b6 = doc().objects[0];
const ang6 = b6 ? rungAngles(b6) : [];
check(doc().objects.length === 1 && isRailSatin(b6) && ang6.length >= 2 && ang6.every((a) => sameAngle(a, 120)), `m.6: direction perpendicular to the long side, 120° (${ang6.map((a) => a.toFixed(2)).join(", ")})`);

// with a cut: one part has a line, the other not
start([bar()]);
const mid = turn([10, -2]);
const mid2 = turn([10, 6]);
const lineIn: Line = [turn([3, 0.5]), turn([5, 3.5])];
const p6b = planSplit(doc(), { id: "bar", cuts: [[mid, mid2]], directions: [lineIn] });
check(!!p6b && p6b.parts === 2 && p6b.auto.length === 1, "m.6: two parts, only the one without a line is automatic");

// --- overlap of the fabric preset --------------------------------------------
const preset = parsePreset("prova.json", {
  schemaVersion: 1,
  id: "prova",
  rev: 1,
  name: { it: "Prova", en: "Test" },
  base: "cotton",
  elastic: false,
  overlap: { flat: 0.3, cap: 0.4 },
  limits: { minSpacingRatio: 0.75 },
  info: { it: "Prova", en: "Test" },
  stabilizer: { type: "tear-away", weight: "medium" },
  topping: "none",
  needlePoint: "normal",
});
setPresetList([preset]);
start([A()], { schemaVersion: 1, fabricPreset: { id: "prova", rev: 1 }, hoopKind: "cap" });
check(planSplit(doc(), { id: "A", cuts: [CUT1], directions: [] })?.overlap === 0.4, "overlap of the preset: cap frame 0.4 mm");
start([A()], { schemaVersion: 1, fabricPreset: { id: "prova", rev: 1 } });
const pf = planSplit(doc(), { id: "A", cuts: [CUT1], directions: [] });
check(pf?.overlap === 0.3, "overlap of the preset: flat hoop, the preset's value");
setPresetList([]);

// --- what is refused ---------------------------------------------------------
start([A()]);
runCommand("m.split.apply", { id: "nope", cuts: [CUT1], directions: [] });
check(doc().objects.length === 1 && doc().objects[0].id === "A", "an unknown object changes nothing");
const line: DesignObject = { ...A(), id: "L", paths: [{ closed: false, nodes: [{ p: [0, 0] }, { p: [5, 5] }] }], stitch: { type: "running", length: 2.5, tolerance: 0.2, repeats: 1, beanRepeats: 0 } as DesignObject["stitch"] };
start([line]);
runCommand("m.split.apply", { id: "L", cuts: [CUT1], directions: [] });
check(doc().objects.length === 1 && doc().objects[0].id === "L", "a line (no closed shape) changes nothing");
// a cut that misses the shape leaves one part
start([A()]);
const pm = planSplit(doc(), { id: "A", cuts: [[[20, 0], [20, 10]]], directions: [DIR_TOP] });
check(pm?.parts === 1, "a cut beside the shape cuts nothing");

off();
done("module m — split and direct");
