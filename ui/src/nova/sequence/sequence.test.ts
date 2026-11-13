// Module b — Sequence list: tests b.1–b.8 (contract, section 4), on the commands
// run through runCommand, the rows of the list and the DST exported by Filum's engine.

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { FLAG, type StitchDocument } from "../../types";
import { getCommand, runCommand } from "../core/commands";
import { on } from "../core/events";
import { setModeSource } from "../core/mode";
import { registerSequenceCommands } from "./commands";
import { focusRow } from "./events";
import { dropTarget, rowStitches, sequenceRows, stitchesPerObject } from "./rows";
import { AT, abc, square } from "./fixture";
import { dstTrims, exportDst, planOfDoc, type DstRecord } from "./dst";

const off = registerSequenceCommands();
const s = () => useStore.getState();
const doc = () => s().doc;
const obj = (id: string) => doc().objects.find((o) => o.id === id)!;
const order = () => doc().objects.map((o) => o.id).join("");
const start = (d: StitchDocument = abc()) => s().setDoc(d);
const cmd = (id: string, p: unknown) => runCommand(id, p);

for (const id of ["b.reorder", "b.setTies", "b.setLock", "b.setTrimAfter", "b.setStopAfter", "b.setStart", "b.setEnd"])
  check(!!getCommand(id), `${id} is registered`);

// which object a DST stitch belongs to: inside its square (±1 mm); the travel between them belongs to none.
// The file is placed by the design's box, whose top-left is A's corner.
const who = (recs: DstRecord[]) => {
  const st = recs.filter((r) => r.kind === "stitch");
  const ox = Math.min(...st.map((r) => r.x)) - AT.A[0] * 10;
  const oy = Math.min(...st.map((r) => r.y)) - AT.A[1] * 10;
  return (r: DstRecord) =>
    Object.keys(AT).find((k) => {
      const [x, y] = [AT[k][0] * 10 + ox, AT[k][1] * 10 + oy];
      return r.x >= x - 10 && r.x <= x + 110 && r.y >= y - 10 && r.y <= y + 110;
    }) ?? "";
};
/** The objects in the order the DST sews them. */
const sewn = (recs: DstRecord[]) => {
  const of = who(recs);
  return recs
    .filter((r) => r.kind === "stitch")
    .map(of)
    .filter((x, i, a) => x && x !== a[i - 1])
    .join("");
};
/** Index of the last stitch of one object and of the first of another. */
const lastOf = (recs: DstRecord[], o: string) => recs.map((r, i) => (r.kind === "stitch" && who(recs)(r) === o ? i : -1)).reduce((a, b) => Math.max(a, b));
const firstOf = (recs: DstRecord[], o: string) => recs.findIndex((r) => r.kind === "stitch" && who(recs)(r) === o);
/** The trims before the last stitch (the file always ends with one). */
const trimsIn = (recs: DstRecord[]) => {
  const end = recs.map((r, i) => (r.kind === "stitch" ? i : -1)).reduce((a, b) => Math.max(a, b));
  return dstTrims(recs).filter((i) => i < end);
};

// b.1 the list shows A, B, C in sewing order; the DST sews A, then B, then C
start();
check(sequenceRows(doc()).map((r) => r.key).join("") === "ABC", "b.1 the list shows A, B, C");
const dst0 = exportDst(doc());
check(sewn(dst0) === "ABC", `b.1 the DST sews A, then B, then C (${sewn(dst0)})`);
check(trimsIn(dst0).length === 0 && !dst0.some((r) => r.kind === "color"), "b.1 (no trim and no stop in the plain design)");

// b.2 trim icon of row B
const steps = s().past.length;
cmd("b.setTrimAfter", { id: "B", value: true });
check(obj("B").trimAfter === true && s().past.length === steps + 1, "b.2 B.trimAfter = true, one undo step");
{
  const recs = exportDst(doc());
  const trims = trimsIn(recs);
  const b = lastOf(recs, "B");
  const c = firstOf(recs, "C");
  check(trims.length === 1 && trims[0] > b && trims[0] < c, `b.2 the DST trims between the last stitch of B and the first of C (trims at ${trims}, B ends ${b}, C starts ${c})`);
}
s().undo();
check(obj("B").trimAfter === false && trimsIn(exportDst(doc())).length === 0, "b.2 one undo takes the trim away");

// b.3 stop icon of row A
cmd("b.setStopAfter", { id: "A", value: true });
{
  const recs = exportDst(doc());
  const stops = recs.map((r, i) => (r.kind === "color" ? i : -1)).filter((i) => i >= 0);
  check(obj("A").stopAfter === true, "b.3 A.stopAfter = true");
  check(stops.length === 1 && stops[0] > lastOf(recs, "A") && stops[0] < firstOf(recs, "B"), `b.3 the DST stops after A (stops at ${stops})`);
}
s().undo();

// ties at the end of an object in the plan
const endTies = (d: StitchDocument, id: string) => {
  const p = planOfDoc(d);
  const k = d.objects.findIndex((o) => o.id === id);
  const idx = [...p.objects.keys()].filter((i) => p.objects[i] === k && !(p.flags[i] & FLAG.COMMANDS));
  // the tie stitches after the object's last plain stitch
  const lastPlain = Math.max(...idx.filter((i) => !(p.flags[i] & FLAG.TIE)));
  return idx.filter((i) => i > lastPlain && p.flags[i] & FLAG.TIE).length;
};
const samePlan = (a: StitchDocument, b: StitchDocument) => {
  const p = planOfDoc(a);
  const q = planOfDoc(b);
  return p.flags.length === q.flags.length && p.flags.every((f, i) => f === q.flags[i] && p.objects[i] === q.objects[i]);
};

// b.4 Studio: the end tie of A turned off from the list
// (the machine trims every gap here, so each object ends with its ties)
setModeSource(() => "studio");
start(abc(false));
const before = doc();
check(endTies(before, "A") > 0, `(A sews ties at its end by default: ${endTies(before, "A")})`);
cmd("b.setTies", { id: "A", ties: "start" });
check(obj("A").ties === "start", "b.4 A.ties = \"start\"");
check(endTies(doc(), "A") === 0, "b.4 the plan has no tie stitches at the end of A");

// b.5 Studio: the tie turned on again is the standard one (machine.lockEnd, Filum's default halfStitch)
start(abc(false, [square("A", { ties: "start", lock: { end: "star", start: "arrow" } }), square("B"), square("C")]));
cmd("b.setTies", { id: "A", ties: "both" });
check(obj("A").ties === undefined && obj("A").lock?.end === undefined && obj("A").lock?.start === "arrow", "b.5 the end tie is back with no shape of its own (the start keeps its own)");
check((doc().machine.lockEnd ?? "halfStitch") === "halfStitch", `b.5 the project's standard end tie is halfStitch (${doc().machine.lockEnd ?? "default"})`);
check(samePlan(doc(), abc(false, [square("A", { lock: { start: "arrow" } }), square("B"), square("C")])), "b.5 the plan sews machine.lockEnd at the end of A");
start(abc(false, [square("A", { ties: "end" }), square("B"), square("C")]));
cmd("b.setTies", { id: "A", ties: "both" });
check(samePlan(doc(), abc(false)), "b.5 an object with both ties on sews like one never changed");
cmd("b.setLock", { id: "A", end: "cross" });
check(obj("A").lock?.end === "cross", "Studio: b.setLock gives the end its own shape");
cmd("b.setLock", { id: "A", end: null });
check(obj("A").lock === undefined, "Studio: b.setLock with null goes back to the standard shape (no lock left in the file)");

// b.6 Assisted: the tie icons change nothing; every object has ties "both" and no lock of its own
setModeSource(() => "assisted");
start();
const assisted = doc();
const n6 = s().past.length;
cmd("b.setTies", { id: "A", ties: "start" });
cmd("b.setTies", { id: "B", ties: "none" });
cmd("b.setLock", { id: "C", start: "star" });
check(doc() === assisted && s().past.length === n6, "b.6 Assisted: no change, no undo step");
check(doc().objects.every((o) => (o.ties ?? "both") === "both" && !o.lock), "b.6 every object has ties \"both\" and no lock of its own");
check(sequenceRows(doc()).every((r) => r.startTie && r.endTie), "b.6 the list shows both ties on every row");
// trims, stops and the order still work in Assisted
cmd("b.setTrimAfter", { id: "A", value: true });
check(obj("A").trimAfter, "Assisted: the trim icon still works");
setModeSource(null);

// b.7 C dragged to the top: C, A, B in the list, in the document and in the DST; one undo step
start();
const rows = sequenceRows(doc());
const target = dropTarget(rows, "C", "A", "above");
check(JSON.stringify(target) === JSON.stringify({ ids: ["C"], toIndex: 0 }), `b.7 dropping C above A moves C to index 0 (${JSON.stringify(target)})`);
const n7 = s().past.length;
cmd("b.reorder", target);
check(order() === "CAB" && sequenceRows(doc()).map((r) => r.key).join("") === "CAB", `b.7 order C, A, B in the document and in the list (${order()})`);
check(s().past.length === n7 + 1, "b.7 one undo step");
const dst7 = exportDst(doc());
check(sewn(dst7) === "CAB", `b.7 the DST sews C, A, B (${sewn(dst7)})`);
s().undo();
check(order() === "ABC", "b.7 one undo gives back A, B, C");
check(dropTarget(rows, "A", "B", "above") === null && dropTarget(rows, "A", "A", "below") === null, "a drop that keeps the order is no change");
check(JSON.stringify(dropTarget(rows, "A", "C", "below")) === JSON.stringify({ ids: ["A"], toIndex: 2 }), "A dropped below C goes last");
cmd("b.reorder", { ids: ["A"], toIndex: 0 });
check(s().past.length === n7 + 1 - 1, "a reorder that changes nothing leaves no undo step");

// b.8 the start of A back to automatic: the field disappears from the file
start(abc(true, [square("A", { start: [12, 12], end: [18, 18] }), square("B"), square("C")]));
cmd("b.setStart", { id: "A", point: null });
check(!("start" in obj("A")) && !JSON.stringify(doc()).includes('"start":[12'), "b.8 A.start is not in the file");
check(JSON.stringify(obj("A").end) === "[18,18]", "b.8 the end point is untouched");
cmd("b.setEnd", { id: "A", point: null });
check(!("end" in obj("A")), "b.setEnd null: A.end is not in the file");

// rows: a lettering is one row; counts from the plan
const letter = (id: string) => ({ ...square("B"), id, name: id, text: { group: "g1" } as never });
start(abc(true, [square("A"), letter("L1"), letter("L2"), letter("L3"), square("C")]));
const lr = sequenceRows(doc());
check(lr.length === 3 && lr[1].text && lr[1].ids.join() === "L1,L2,L3", "a lettering is one row");
check(JSON.stringify(dropTarget(lr, "C", "L1", "above")) === JSON.stringify({ ids: ["C"], toIndex: 1 }), "a row dropped on a lettering goes before all its letters");
check(JSON.stringify(dropTarget(lr, "L1", "A", "above")) === JSON.stringify({ ids: ["L1", "L2", "L3"], toIndex: 0 }), "a lettering moves as one row");
const counts = stitchesPerObject(doc(), planOfDoc(doc()));
const total = [...counts.values()].reduce((a, b) => a + b, 0);
const p = planOfDoc(doc());
check(total === [...p.flags].filter((f) => !(f & FLAG.COMMANDS)).length && total > 0, "the counts of the rows add up to the plan's stitches");
check(rowStitches(lr[1], counts) === (counts.get("L1") ?? 0) + (counts.get("L2") ?? 0) + (counts.get("L3") ?? 0), "a lettering's row counts all its letters");
check(rowStitches(lr[0], null) === undefined, "no plan yet: no count");

// sequence.rowFocused is an event of the bus
let focused = "";
const stop = on("sequence.rowFocused", (e) => (focused = e.id));
focusRow("A");
stop();
check(focused === "A", "sequence.rowFocused carries the row's id");
off();
done("sequence list (b)");
