// Module m — «Dividi e dirigi» on curved parts: test m.9 (contract, «Prove
// della build 1, seconda parte», 25/11). The rails are the two sides of the
// outline between the cuts; the rungs follow the column, across its middle
// line point by point; a direction line becomes a rung where it lies.

import { check, done } from "../core/testkit";
import { useStore, emptyDoc } from "../../store";
import type { DesignObject, StitchDocument, Vec2 } from "../../types";
import { runCommand } from "../core/commands";
import { isRailSatin, railMap } from "../../lib/nodeOps";
import { registerSatinToolCommands } from "./commands";
import { planSplit, type Line } from "./split";
import { A_CUTS, A_HOLE, A_OUT, letterA } from "./fixtures";

const s = () => useStore.getState();
const doc = () => s().doc;
const off = registerSatinToolCommands();

function start(objects: DesignObject[]): void {
  const d: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects };
  s().setDoc(d);
}
function inside(rings: Vec2[][], q: Vec2): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [p, t] = [r[i], r[j]];
      if (p[1] > q[1] !== t[1] > q[1] && q[0] < ((t[0] - p[0]) * (q[1] - p[1])) / (t[1] - p[1]) + p[0]) c = !c;
    }
  return c;
}
const outline = (o: DesignObject): Vec2[] => [...o.paths[0].nodes.map((n) => n.p), ...o.paths[1].nodes.map((n) => n.p).reverse()];
/** Proper crossing of two segments (touching ends do not count). */
function crosses(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const c = (o: Vec2, p: Vec2, q: Vec2) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const e = 1e-9;
  const d1 = c(q1, q2, p1);
  const d2 = c(q1, q2, p2);
  const d3 = c(p1, p2, q1);
  const d4 = c(p1, p2, q2);
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}
/** The rungs (node pairs) of a two-rail satin, in order. */
function rungsOf(o: DesignObject): [Vec2, Vec2][] {
  const m = railMap(o.paths[0], o.paths[1]);
  return m ? o.paths[0].nodes.map((n, i) => [n.p, o.paths[1].nodes[m.at(i)].p] as [Vec2, Vec2]) : [];
}
/**
 * Largest angle (degrees) between a rung and the perpendicular to the middle
 * line there, away from the ends (more than one column width in: near an end
 * its shape decides the rungs). The middle line's direction is taken over one
 * column width, the scale of a satin's stitches.
 */
function worstRung(o: DesignObject): { worst: number; n: number } {
  const r = rungsOf(o);
  const mid = r.map(([p, q]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Vec2);
  const along = [0];
  for (let k = 1; k < mid.length; k++) along.push(along[k - 1] + Math.hypot(mid[k][0] - mid[k - 1][0], mid[k][1] - mid[k - 1][1]));
  const total = along[along.length - 1];
  const widths = r.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1])).sort((x, y) => x - y);
  const width = widths[Math.floor(widths.length / 2)];
  let worst = 0;
  let n = 0;
  for (let k = 0; k < r.length; k++) {
    const [p, q] = r[k];
    const w = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (w < 0.3 || along[k] < width || along[k] > total - width) continue;
    // the middle line's direction over one column width (half each way)
    let i = k;
    while (i > 0 && along[k] - along[i] < width / 2) i--;
    let j = k;
    while (j < r.length - 1 && along[j] - along[k] < width / 2) j++;
    const t: Vec2 = [mid[j][0] - mid[i][0], mid[j][1] - mid[i][1]];
    const tl = Math.hypot(t[0], t[1]);
    if (tl < 1e-6) continue;
    const cos = Math.abs((t[0] * (q[0] - p[0]) + t[1] * (q[1] - p[1])) / (tl * w));
    worst = Math.max(worst, 90 - (Math.acos(Math.min(1, cos)) * 180) / Math.PI);
    n++;
  }
  return { worst, n };
}

// --- m.9 -------------------------------------------------------------------
start([letterA()]);
const plan = planSplit(doc(), { id: "a", cuts: A_CUTS, directions: [] });
check(!!plan && plan.parts === 2 && plan.notOneColumn.length === 0, `m.9: two satins (${plan?.parts})`);
runCommand("m.split.apply", { id: "a", cuts: A_CUTS, directions: [] });
const made = doc().objects;
check(made.length === 2 && made.every((o) => o.stitch.type === "satin" && isRailSatin(o)), "m.9: both are two-rail satins of Filum");
const belly = made.find((o) => inside([outline(o)], [3.3, 3.5]));
const stem = made.find((o) => inside([outline(o)], [9, 1]));
check(!!belly && !!stem && belly !== stem, "m.9: one satin is the belly, the other the arch and stem");
check(!!stem && inside([outline(stem)], [5, 11.5]) && inside([outline(stem)], [9, 8]), "m.9: the arch and the stem are one satin");

// covered area ≥ 99 % of the «a»
let tried = 0;
let hit = 0;
for (let x = 0.0123; x < 10.5; x += 0.1)
  for (let y = 0.0171; y < 13.5; y += 0.1) {
    if (!inside([A_OUT, A_HOLE], [x, y])) continue;
    tried++;
    if (made.some((o) => inside([outline(o)], [x, y]))) hit++;
  }
check(tried > 3000 && hit / tried >= 0.99, `m.9: area covered ${((100 * hit) / tried).toFixed(2)} % of the «a» (≥ 99 %)`);

for (const [o, name] of [
  [belly, "belly"],
  [stem, "arch and stem"],
] as const) {
  if (!o) continue;
  const r0 = o.paths[0].nodes.map((n) => n.p);
  const r1 = o.paths[1].nodes.map((n) => n.p);
  let railCross = 0;
  for (let i = 1; i < r0.length; i++) for (let j = 1; j < r1.length; j++) if (crosses(r0[i - 1], r0[i], r1[j - 1], r1[j])) railCross++;
  check(railCross === 0, `m.9: ${name}: the rails do not cross (${railCross})`);
  const rg = rungsOf(o);
  let rungCross = 0;
  for (let k = 1; k < rg.length; k++) if (crosses(rg[k - 1][0], rg[k - 1][1], rg[k][0], rg[k][1])) rungCross++;
  check(rg.length > 2 && rungCross === 0, `m.9: ${name}: the rungs do not cross each other (${rungCross})`);
  const { worst, n } = worstRung(o);
  check(n > 20 && worst <= 15, `m.9: ${name}: ${n} rungs, each within 15° of the perpendicular to the middle line (worst ${worst.toFixed(1)}°)`);
  // no rung leaves the part (a rung's middle lies inside the «a»)
  const outside = rg.filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05 && !inside([A_OUT, A_HOLE], [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])).length;
  check(outside === 0, `m.9: ${name}: every rung lies inside the «a» (${outside} outside)`);
}

// the belly ends at the cuts; the arch and stem run from the arch's tip to the foot of the stem
const ends = (o: DesignObject): [Vec2, Vec2][] => {
  const n0 = o.paths[0].nodes;
  const n1 = o.paths[1].nodes;
  return [
    [n0[0].p, n1[0].p],
    [n0[n0.length - 1].p, n1[n1.length - 1].p],
  ];
};
const onCut = (p: Vec2, c: Line) => {
  const d: Vec2 = [c[1][0] - c[0][0], c[1][1] - c[0][1]];
  return Math.abs(d[0] * (p[1] - c[0][1]) - d[1] * (p[0] - c[0][0])) / Math.hypot(d[0], d[1]) < 0.15;
};
if (belly) {
  const [e0, e1] = ends(belly);
  const atCut = (e: [Vec2, Vec2]) => A_CUTS.some((c) => onCut(e[0], c) && onCut(e[1], c));
  check(atCut(e0) && atCut(e1), "m.9: the belly's ends are the two cuts");
}
if (stem) {
  const mids = ends(stem).map(([p, q]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Vec2);
  const tip = mids.some((m) => Math.hypot(m[0] - 3.2, m[1] - 10) < 1.5);
  const foot = mids.some((m) => m[1] < 0.6 && m[0] > 7.5);
  check(tip && foot, `m.9: the arch and stem run from the arch's tip to the stem's foot (${mids.map((m) => m.map((x) => x.toFixed(1)).join(",")).join(" / ")})`);
}

// one Annulla brings back the «a»
s().undo();
check(doc().objects.length === 1 && doc().objects[0].id === "a", "m.9: one Annulla brings back the «a»");

// a direction line becomes a rung where it lies
start([letterA()]);
const DIR: Line = [
  [2.7, 3.3],
  [4.0, 3.5],
];
runCommand("m.split.apply", { id: "a", cuts: A_CUTS, directions: [DIR] });
const b2 = doc().objects.find((o) => inside([outline(o)], [3.3, 3.5]));
const want = Math.atan2(DIR[1][1] - DIR[0][1], DIR[1][0] - DIR[0][0]);
// the rung nearest the line's place on the belly
const offAngle = ([p, q]: [Vec2, Vec2]) => {
  const dd = ((((Math.atan2(q[1] - p[1], q[0] - p[0]) - want) * 180) / Math.PI) % 180 + 180) % 180;
  return Math.min(dd, 180 - dd);
};
const nearLine = b2 ? rungsOf(b2).filter(([p, q]) => Math.hypot((p[0] + q[0]) / 2 - 3.35, (p[1] + q[1]) / 2 - 3.4) < 0.6) : [];
const at = nearLine.length ? nearLine.reduce((x, y) => (offAngle(y) < offAngle(x) ? y : x)) : undefined;
const diffDeg = at ? offAngle(at) : NaN;
check(!!at && diffDeg < 0.5, `m.9: the direction line is a rung of the belly where it lies (${diffDeg.toFixed(2)}° off)`);

off();
done("module m — curved parts");
