// Module m — «Satin a due binari»: tests m.1, m.2, m.3 and m.8 (contract,
// section 4, with the Signor Poletti's change of 18/11) on the pure parts of
// the tool — the click sequence, the preview marks — and on the command
// m.satin.fromClicks run through runCommand. m.7 (cursor cross) waits for module c.

import { check, done } from "../core/testkit";
import { useStore, emptyDoc } from "../../store";
import type { StitchDocument, Vec2 } from "../../types";
import { runCommand } from "../core/commands";
import { isRailSatin, railMap } from "../../lib/nodeOps";
import { satinRailIndices } from "../../lib/geometry";
import { registerSatinToolCommands } from "./commands";
import { draftStep, emptyDraft, pairClicks, previewOf, type TwoRailDraft } from "./twoRails";

const s = () => useStore.getState();
const doc = () => s().doc;
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const off = registerSatinToolCommands();

function start(): StitchDocument {
  const d = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }] };
  s().setDoc(d);
  return d;
}

/** Feed clicks (left button unless said) then a key; returns the last result. */
function play(clicks: [Vec2, "left" | "right"][], key: "enter" | "escape") {
  let draft: TwoRailDraft | null = emptyDraft();
  for (const [p, button] of clicks) draft = draftStep(draft, { type: "click", p, button }).draft;
  const r = draftStep(draft, { type: key });
  if (r.create) runCommand("m.satin.fromClicks", r.create);
  return r;
}

// Non-parallel rails: S1, D1, S2, D2 (the left rail widens, the right one bends away)
const S1: Vec2 = [10, 10];
const D1: Vec2 = [20, 12];
const S2: Vec2 = [8, 40];
const D2: Vec2 = [30, 38];

// --- m.1 -------------------------------------------------------------------
start();
const r1 = play(
  [
    [S1, "left"],
    [D1, "left"],
    [S2, "left"],
    [D2, "left"],
  ],
  "enter",
);
check(!r1.warning, "m.1: four clicks and Enter, no warning");
check(doc().objects.length === 1, "m.1: one object made");
const o = doc().objects[0];
check(!!o && o.stitch.type === "satin" && isRailSatin(o), "m.1: it is a two-rail satin of Filum (two paths, not multi)");
check(!!o && o.paths.every((sp) => !sp.closed && sp.nodes.length === 2), "m.1: two open rails, two nodes each");
const ri = o ? satinRailIndices(o.paths) : null;
check(!!ri && ri[0] === 0 && ri[1] === 1, "m.1: the engine takes path 1 and path 2 as the rails");
const map = o ? railMap(o.paths[0], o.paths[1]) : null;
check(!!map && !map.rev && map.at(0) === 0 && map.at(1) === 1, "m.1: the rungs are the click pairs S1–D1 and S2–D2");
check(!!o && o.paths[0].nodes.map((n) => n.p).join() === [S1, S2].join() && o.paths[1].nodes.map((n) => n.p).join() === [D1, D2].join(), "m.1: binario 1 = S1, S2; binario 2 = D1, D2");
check(!!o && o.paths.every((sp) => sp.nodes.every((n) => !n.i && !n.o)), "m.1: left clicks make straight nodes");
check(!!o && o.thread === "T1", "m.1: the satin takes the thread passed by the tool, else the first one");
check(!!o && o.stitch.type === "satin" && o.stitch.reverseRails === "none", "m.1: the engine keeps the pairs as clicked (rails never reversed)");
check(!!o && o.stitch.type === "satin" && !o.stitch.guides?.length && !o.stitch.multi, "m.1: no direction guides, the click pairs set the stitch angle");
// one undo step
s().undo();
check(doc().objects.length === 0, "m.1: one Annulla removes the satin");
s().redo();

// preview: rails 1 and 2 with square points, blue and orange; a dashed grey rung per pair
let d4: TwoRailDraft | null = emptyDraft();
for (const p of [S1, D1, S2, D2]) d4 = draftStep(d4, { type: "click", p, button: "left" }).draft;
const pv = previewOf(d4!);
check(pv.points.length === 4 && pv.points.every((m) => m.shape === "square"), "m.1: preview points are squares on both rails");
check(pv.points.filter((m) => m.rail === 1).every((m) => m.color === "blue") && pv.points.filter((m) => m.rail === 2).every((m) => m.color === "orange"), "m.1: rail 1 blue, rail 2 orange");
check(pv.points.map((m) => m.rail).join() === "1,2,1,2", "m.1: clicks alternate rail 1 / rail 2");
check(pv.rungs.length === 2 && pv.rungs.every((g) => g.dashed && g.color === "grey"), "m.1: a dashed grey rung between each pair");
check(pv.rails.length === 2 && pv.rails[0].color === "blue" && pv.rails[1].color === "orange", "m.1: the rails are drawn blue and orange");
// with three clicks the third is waiting for its pair: no rung for it yet
let d3: TwoRailDraft | null = emptyDraft();
for (const p of [S1, D1, S2]) d3 = draftStep(d3, { type: "click", p, button: "left" }).draft;
check(previewOf(d3!).rungs.length === 1, "preview: an unpaired click has no rung yet");

// --- m.2 -------------------------------------------------------------------
start();
const r2 = play(
  [
    [S1, "left"],
    [D1, "left"],
    [S2, "left"],
    [D2, "left"],
    [[5, 60], "left"],
  ],
  "enter",
);
check(r2.warning === "m.twoRails.oddDropped", "m.2: five clicks and Enter warn that the last point is dropped");
const o2 = doc().objects[0];
check(doc().objects.length === 1 && o2.paths.every((sp) => sp.nodes.length === 2), "m.2: a satin with two pairs");
check(!!o2 && !o2.paths.some((sp) => sp.nodes.some((n) => n.p[1] === 60)), "m.2: the fifth point is not in the satin");
const pc = pairClicks([S1, D1, S2, D2, [5, 60]].map((p) => ({ p: p as Vec2 })));
check(pc.left.length === 2 && pc.right.length === 2 && pc.dropped?.p[1] === 60, "m.2: pairClicks drops the odd click");

// too few: a single pair is no satin, the drawing goes on
start();
let dd: TwoRailDraft | null = emptyDraft();
for (const p of [S1, D1]) dd = draftStep(dd, { type: "click", p, button: "left" }).draft;
const few = draftStep(dd, { type: "enter" });
check(few.warning === "m.twoRails.tooFew" && !few.create && !!few.draft && few.draft.clicks.length === 2, "Enter with one pair warns and keeps drawing");

// --- m.3 -------------------------------------------------------------------
start();
const r3 = play(
  [
    [S1, "left"],
    [D1, "left"],
    [S2, "left"],
  ],
  "escape",
);
check(r3.draft === null && !r3.create, "m.3: Esc ends the drawing without a command");
check(doc().objects.length === 0, "m.3: no object made");

// --- m.8 -------------------------------------------------------------------
// right click on S2 and D2: the rails curve in those nodes, straight in the others
start();
const S3: Vec2 = [12, 70];
const D3: Vec2 = [26, 72];
play(
  [
    [S1, "left"],
    [D1, "left"],
    [S2, "right"],
    [D2, "right"],
    [S3, "left"],
    [D3, "left"],
  ],
  "enter",
);
const o8 = doc().objects[0];
check(!!o8 && isRailSatin(o8) && o8.paths.every((sp) => sp.nodes.length === 3), "m.8: a two-rail satin with three pairs");
const curvedAt = (k: 0 | 1) => o8.paths[k].nodes.map((n) => !!(n.i && n.o));
check(!!o8 && curvedAt(0).join() === "false,true,false", "m.8: rail 1 curved at S2 only");
check(!!o8 && curvedAt(1).join() === "false,true,false", "m.8: rail 2 curved at D2 only");
check(!!o8 && o8.paths.every((sp) => !sp.nodes[0].i && !sp.nodes[0].o && !sp.nodes[2].i && !sp.nodes[2].o), "m.8: S1, D1, S3, D3 stay straight (no handles)");
// the handles are smooth (in line through the node) and follow the neighbours
const n2 = o8?.paths[0].nodes[1];
if (n2?.i && n2.o) {
  const a: Vec2 = [n2.p[0] - n2.i[0], n2.p[1] - n2.i[1]];
  const b: Vec2 = [n2.o[0] - n2.p[0], n2.o[1] - n2.p[1]];
  check(near(a[0] * b[1] - a[1] * b[0], 0, 1e-9) && a[0] * b[0] + a[1] * b[1] > 0, "m.8: a curved node is smooth (handles in line)");
  const t: Vec2 = [S3[0] - S1[0], S3[1] - S1[1]];
  check(near(b[0] * t[1] - b[1] * t[0], 0, 1e-9), "m.8: the handles follow the line from the previous to the next point");
}
// right click is a curved node in the preview too (still a square)
let d8: TwoRailDraft | null = emptyDraft();
d8 = draftStep(d8, { type: "click", p: S1, button: "right" }).draft;
check(d8!.clicks[0].curved === true && previewOf(d8!).points[0].shape === "square" && previewOf(d8!).points[0].curved === true, "m.8: right click records a curved node, still a square point");

// the command alone, as other code would call it: plain points are straight
start();
runCommand("m.satin.fromClicks", { left: [S1, S2], right: [D1, D2] });
check(doc().objects.length === 1 && isRailSatin(doc().objects[0]), "m.satin.fromClicks takes plain points too");
runCommand("m.satin.fromClicks", { left: [S1], right: [D1] });
check(doc().objects.length === 1, "m.satin.fromClicks with one pair changes nothing");

off();
done("module m — two-rail satin");
