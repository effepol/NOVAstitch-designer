// Hooks for module e and Filum's mirror (module 0, request of 18/11 evening).
// (1) Fabric change through chooseFabric: a registered chooser runs it as its
//     command (one undo step); without one, Filum's own change.
// (2) setFabricDefaults made composable: the values registered by a module
//     (the preset), then Filum's fabric calibration on top.
// (3) registerIssueCheck: computeIssues lists the modules' issues after Filum's.
// (4) Filum's mirror (lib/arrange.ts) corrected: a reflection inverts the
//     satin's swapRails; start/end set by hand move with the same matrix.
//     Tests f.1–f.5 of the contract; f.4: mirror twice = the same document.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { emptyDoc, useStore } from "../../store";
import type { DesignObject, StitchDocument, SubPath, Vec2 } from "../../types";
import { FLAG } from "../../types";
import { chooseFabric, registerFabricChooser } from "./fabricChoice";
import { composedFabricDefaults, registerObjectDefaults } from "./objectDefaults";
import { registerIssueCheck } from "./issueChecks";
import { defaultFill, defaultRunning, defaultSatin, setFabricDefaults } from "../../lib/geometry";
import { computeIssues } from "../../lib/issues";
import { mirrorSelection, repeatSelection } from "../../lib/arrange";
import { setModeSource } from "./mode";

const st = () => useStore.getState();
const reset = (doc: StitchDocument) => useStore.setState({ doc, past: [], future: [], selection: [], plan: null });

// ---------------------------------------------------------------- (1) fabric
reset({ ...emptyDoc(), fabric: "cotton" });
st().setFabric("knit");
check(st().doc.fabric === "knit" && st().past.length === 1, "without a chooser, setFabric is Filum's own change (one undo step)");

const asked: string[] = [];
const offF = registerFabricChooser({
  module: "e",
  choose(f) {
    asked.push(f);
    st().commit((d) => ({ ...d, fabric: f, nova: { ...d.nova, fabricPreset: { id: `p-${f}` } } as StitchDocument["nova"] }));
    return true;
  },
});
st().setFabric("denim");
check(asked.join() === "denim" && st().doc.fabric === "denim", "with a chooser, setFabric goes to it");
check(st().past.length === 2, "the module's command is one undo step");
st().undo();
check(st().doc.fabric === "knit", "one undo brings the fabric back");
let dupF = false;
try {
  registerFabricChooser({ module: "x", choose: () => true });
} catch {
  dupF = true;
}
check(dupF, "one fabric chooser at a time");
offF();
const offDecline = registerFabricChooser({ module: "e", choose: () => false });
st().setFabric("towel");
check(st().doc.fabric === "towel", "a chooser that declines leaves the change to Filum");
offDecline();
let fb = 0;
chooseFabric("felt", () => fb++);
check(fb === 1, "removed: Filum's own change again");

const src = (f: string) => readFileSync(path.join(process.cwd(), "src", f), "utf8");
check(/setFabric: \(fabric\) => chooseFabric\(fabric, /.test(src("store.ts")), "store.setFabric goes through chooseFabric");
for (const f of ["components/Bars.tsx", "components/MaterialPanel.tsx"])
  check(/useStore\.getState\(\)\.setFabric\(/.test(src(f)), `${f}: the fabric picker calls store.setFabric (so chooseFabric)`);

// ---------------------------------------------------------------- (2) defaults
let calibration: { satin?: Record<string, number>; fill?: Record<string, number> } = {};
setFabricDefaults(composedFabricDefaults(() => calibration));
const plainSatin = defaultSatin();
check(defaultSatin().pullComp === plainSatin.pullComp, "nothing registered, no calibration: Filum's defaults");
calibration = { satin: { pullComp: 0.6 }, fill: { expand: 0.3 } };
check(defaultSatin().pullComp === 0.6 && defaultFill().expand === 0.3, "the calibration keeps working");
const offD = registerObjectDefaults({ id: "e.preset", module: "e", values: () => ({ satin: { pullComp: 0.2, density: 0.38 } as never, fill: { rowSpacing: 0.35 } as never, running: { length: 2.2 } as never }) });
const s = defaultSatin() as unknown as Record<string, number>;
const f = defaultFill() as unknown as Record<string, number>;
check(s.pullComp === 0.6, "the calibration goes on top of the preset (pull compensation)");
check(s.density === 0.38 && f.rowSpacing === 0.35 && f.expand === 0.3, "the preset's values the calibration does not set stay");
check((defaultRunning() as unknown as Record<string, number>).length === 2.2, "running stitches take the registered values too");
let dupD = false;
try {
  registerObjectDefaults({ id: "e.preset", module: "e", values: () => ({}) });
} catch {
  dupD = true;
}
check(dupD, "an id registers once");
offD();
check((defaultSatin() as unknown as Record<string, number>).density === (plainSatin as unknown as Record<string, number>).density, "removed: the preset's values go");
calibration = {};
check(/setFabricDefaults\(composedFabricDefaults\(\(\) => calibratedDefaults\(/.test(src("main.tsx")), "main.tsx: module 0's composed function, the calibration on top");

// ---------------------------------------------------------------- (3) issues
const rect = (x: number, y: number, w: number, h: number): SubPath => ({
  closed: true,
  nodes: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map((p) => ({ p: p as Vec2 })),
});
const fillObj: DesignObject = {
  id: "F",
  name: "F",
  thread: "T1",
  visible: true,
  locked: false,
  paths: [rect(10, 10, 20, 20)],
  stitch: { type: "fill", ...defaultFill(), angle: 30 },
  trimAfter: false,
  stopAfter: false,
};
const docI: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects: [fillObj] };
const filumOnly = computeIssues(docI, null).length;
const offI = registerIssueCheck({ id: "e.fabric", module: "e", check: (d) => [{ id: "e.test:F", objId: d.objects[0].id, level: "warning", title: "T", detail: "D", at: [20, 20] }] });
const docI2 = { ...docI };
const withE = computeIssues(docI2, null);
check(withE.length === filumOnly + 1 && withE[withE.length - 1].id === "e.test:F", "a registered check's issues come after Filum's");
const offBad = registerIssueCheck({ id: "x.bad", module: "x", check: () => { throw new Error("boom"); } });
const docI3 = { ...docI };
const err = console.error;
console.error = () => {};
const withBad = computeIssues(docI3, null);
console.error = err;
check(withBad.length === filumOnly + 1, "a check that fails does not take Filum's issues with it");
offBad();
offI();
check(computeIssues({ ...docI }, null).length === filumOnly, "removed: Filum's issues only");

// ---------------------------------------------------------------- (4) mirror
initSync({ module: readFileSync(path.join(process.cwd(), "src", "wasm", "pkg", "filum_wasm_bg.wasm")) });
const engine = new StitchEngine();
type Plan = { coords: Float32Array; flags: Uint8Array; objects: Uint32Array };
const plan = (d: StitchDocument) => engine.plan(JSON.stringify(d)) as Plan;
const line = (a: Vec2, b: Vec2): SubPath => ({ closed: false, nodes: [{ p: a }, { p: b }] });
const bareSatin = { ...defaultSatin(), centerWalk: false, contourUnderlay: false, zigzagUnderlay: false, underlayAuto: false, pullComp: 0, pullCompPct: 0, maxStitchLength: 50 };
const twoRails: DesignObject = {
  id: "S",
  name: "S",
  thread: "T1",
  visible: true,
  locked: false,
  paths: [line([0, 0], [30, 0]), line([0, 4], [30, 4])],
  stitch: { type: "satin", ...bareSatin, swapRails: false, guides: [[[10, -1], [12, 5]]] },
  trimAfter: false,
  stopAfter: false,
  ties: "none",
} as DesignObject;
const baseDoc = (objects: DesignObject[]): StitchDocument => ({ ...docI, objects });

/** The side of the first top stitch, against the sewing direction: +1 left, −1 right (sign of the cross product). */
function firstSide(d: StitchDocument): number {
  const p = plan(d);
  const pts: Vec2[] = [];
  for (let i = 0; i < p.flags.length; i++) if (!(p.flags[i] & (FLAG.UNDERLAY | FLAG.TRAVEL | FLAG.TIE | FLAG.JUMP | FLAG.COMMANDS))) pts.push([p.coords[2 * i], p.coords[2 * i + 1]]);
  const a = pts[0];
  const far = pts[pts.length - 1];
  // the sewing direction: from the first stitches towards the last ones; the side: across it, from the middle of the first stitch
  const mid: Vec2 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
  const dir: Vec2 = [far[0] - mid[0], far[1] - mid[1]];
  return Math.sign(dir[0] * (a[1] - mid[1]) - dir[1] * (a[0] - mid[0]));
}
const close = (a: Vec2 | undefined, b: Vec2) => !!a && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const mirrorAll = (axis: "h" | "v") => {
  st().select(st().doc.objects.map((o) => o.id));
  mirrorSelection(axis);
};

// f.1
reset(baseDoc([twoRails]));
const side0 = firstSide(st().doc);
mirrorAll("h");
const m1 = st().doc.objects[0];
const rails = m1.paths.map((p) => p.nodes.map((n) => n.p));
check(close(rails[0][0], [30, 0]) && close(rails[0][1], [0, 0]) && close(rails[1][0], [30, 4]) && close(rails[1][1], [0, 4]), "f.1 rails reflected about x = 15");
check(m1.stitch.type === "satin" && m1.stitch.swapRails === true, "f.1 swapRails = true");
const g = m1.stitch.type === "satin" ? m1.stitch.guides?.[0] : undefined;
check(!!g && close(g[0], [20, -1]) && close(g[1], [18, 5]), "f.1 rung [[20,-1],[18,5]]");
check(side0 !== 0 && firstSide(st().doc) === side0, "f.1 the first stitch on the same side of the sewing direction as before");

// f.2
const centre: DesignObject = { ...twoRails, id: "C", paths: [line([0, 10], [30, 14])], stitch: { type: "satin", ...bareSatin, width: 3, swapRails: false } } as DesignObject;
reset(baseDoc([centre]));
const side2 = firstSide(st().doc);
mirrorAll("v");
const m2 = st().doc.objects[0];
// the engine makes a centre line's rails as offsets to its left and right (satin.rs): a mirror keeps
// the first stitch's side by itself, so swapRails stays (inverting it would move the first stitch across)
check(m2.stitch.type === "satin" && m2.stitch.swapRails === false, "f.2 centre-line satin, vertical mirror: swapRails as it was (rails made from the line)");
check(side2 !== 0 && firstSide(st().doc) === side2, "f.2 the first stitch's side against the sewing direction unchanged");

// f.3
reset(baseDoc([{ ...twoRails, start: [2, 1], end: [28, 3] }]));
mirrorAll("h");
const m3 = st().doc.objects[0];
check(close(m3.start, [28, 1]) && close(m3.end, [2, 3]), "f.3 start (28, 1), end (2, 3)");
reset(baseDoc([twoRails]));
mirrorAll("h");
check(st().doc.objects[0].start === undefined && st().doc.objects[0].end === undefined, "f.3 automatic start/end stay automatic");

// f.4 (Assisted: nothing recorded in nova.edited, so the whole document can be compared)
setModeSource(() => "assisted");
for (const axis of ["h", "v"] as const) {
  const original = baseDoc([{ ...twoRails, start: [2, 1], end: [28, 3] }, centre, { ...fillObj, id: "F2", paths: [rect(40, 10, 20, 10)] }]);
  reset(original);
  mirrorAll(axis);
  mirrorAll(axis);
  check(JSON.stringify(st().doc) === JSON.stringify(original), `f.4 mirror twice (${axis}): the same document`);
}
setModeSource(null);

// f.5
reset(baseDoc([fillObj]));
mirrorAll("h");
const m5 = st().doc.objects[0];
// Filum keeps a fill angle in (−90, 90]: 150° is −30° (the same rows)
check(m5.stitch.type === "fill" && Math.abs((((m5.stitch.angle - 150) % 180) + 180) % 180) < 1e-9, "f.5 fill at 30°, horizontal mirror: 150° (−30° in Filum's range)");

// the repeats (mirror-merge, kaleidoscope) use the same correction
reset(baseDoc([twoRails]));
st().select(["S"]);
repeatSelection({ mode: "mirrorH", copies: 2, center: [15, 2] });
const copy = st().doc.objects.find((o) => o.id !== "S");
check(copy?.stitch.type === "satin" && copy.stitch.swapRails === true, "mirror-merge copy: swapRails inverted");
reset(baseDoc([twoRails]));
st().select(["S"]);
repeatSelection({ mode: "wreath", copies: 2, center: [15, 20] });
const turned = st().doc.objects.find((o) => o.id !== "S");
check(turned?.stitch.type === "satin" && turned.stitch.swapRails === false, "a wreath copy (a turn, not a mirror): swapRails as it was");

done("innesti e/specchio");
