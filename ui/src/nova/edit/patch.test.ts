// Module f — Patch: tests f.10–f.16 (contract, section 4), on the commands
// f.patch.* run through runCommand, the PatchGroup in nova.patchGroups and the
// event patch.outsideHoop.

import { check, done } from "../core/testkit";
import { useStore, emptyDoc } from "../../store";
import type { DesignObject, StitchDocument } from "../../types";
import { getCommand, runCommand } from "../core/commands";
import { on } from "../core/events";
import { defaultSatin, objectBounds, unionBoxes } from "../../lib/geometry";
import { colorChanges, patchGroups } from "./patch";
import { installPatch } from "./install";

const s = () => useStore.getState();
const doc = () => s().doc;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** A fill rectangle of `w` × `h` mm with its top-left at (x, y). */
function rect(id: string, x: number, y: number, w: number, h: number, thread = "R"): DesignObject {
  const pts: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  return {
    id,
    name: id,
    thread,
    visible: true,
    locked: false,
    paths: [{ closed: true, nodes: pts.map((p) => ({ p })) }],
    stitch: { type: "running", length: 2.5, tolerance: 0.2, repeats: 1, beanRepeats: 0 },
    trimAfter: false,
    stopAfter: false,
    nova: { edited: ["stitch.length"] },
  };
}

function design(objects: DesignObject[], hoop = { name: "Grande", width: 300, height: 300 }): StitchDocument {
  return {
    ...emptyDoc(),
    name: "Patch",
    hoop,
    threads: [
      { id: "R", name: "Rosso", color: "#cc0000", brand: "", code: "" },
      { id: "B", name: "Blu", color: "#0000cc", brand: "", code: "" },
      { id: "G", name: "Verde", color: "#00cc00", brand: "", code: "" },
    ],
    objects,
  };
}

const offInstall = installPatch();
for (const id of ["f.patch.create", "f.patch.setOrder", "f.patch.setColorGrouping", "f.patch.center"]) check(!!getCommand(id), `${id} is registered`);

const outside: unknown[] = [];
const offEv = on("patch.outsideHoop", (p) => outside.push(p));
const group = () => patchGroups(doc()).at(-1)!;
const byId = (id: string) => doc().objects.find((o) => o.id === id)!;
const box = (ids: string[]) => unionBoxes(ids.map((id) => objectBounds(byId(id))))!;
const cell = (r: number, c: number) => group().cells.find((x) => x.row === r && x.col === c)!;

// ---- f.10: source 40×30 at (10,10), 2 rows × 3 cols, gap 5 / 8 mm
s().setDoc(design([rect("S", 10, 10, 40, 30)]));
const sourceBefore = JSON.stringify(byId("S"));
let past = s().past.length;
runCommand("f.patch.create", { sourceIds: ["S"], rows: 2, cols: 3, gap: [5, 8], order: "rows", colorGrouping: "byCopy" });
check(s().past.length === past + 1, "f.patch.create is one undo step");
check(doc().objects.length === 6, `f.10 6 pieces, the source included (${doc().objects.length})`);
check(JSON.stringify(byId("S")) === sourceBefore, "f.10 the source stays as it was");
check(patchGroups(doc()).length === 1, "f.10 one PatchGroup in nova.patchGroups");
const g10 = group();
check(g10.rows === 2 && g10.cols === 3 && g10.gap[0] === 5 && g10.gap[1] === 8 && g10.cells.length === 6, "f.10 the group records rows, cols, gap and 6 cells");
check(cell(0, 0).objectIds.join() === "S", "f.10 the source is cell [0,0]");
const xs = [0, 1, 2].map((c) => box(cell(0, c).objectIds).x);
const ys = [0, 1].map((r) => box(cell(r, 0).objectIds).y);
check(xs.every((x, i) => near(x, [10, 55, 100][i])) && ys.every((y, i) => near(y, [10, 48][i])), `f.10 origins x 10, 55, 100 and y 10, 48 (${xs} / ${ys})`);
const all = box(doc().objects.map((o) => o.id));
check(near(all.w, 130) && near(all.h, 68), `f.10 footprint 130×68 (${all.w}×${all.h})`);
const copies = doc().objects.filter((o) => o.id !== "S");
check(new Set(doc().objects.map((o) => o.id)).size === 6, "f.10 every piece has its own id");
check(copies.every((o) => o.thread === "R" && JSON.stringify(o.stitch) === JSON.stringify(byId("S").stitch) && o.nova?.edited?.join() === "stitch.length"), "f.10 the copies keep stitch parameters, thread and nova.edited");
check(outside.length === 0, "f.10 inside a 300×300 hoop: no patch.outsideHoop");

// ---- f.11: as f.10 in a 100×100 hoop
s().setDoc(design([rect("S", 10, 10, 40, 30)], { name: "Piccolo", width: 100, height: 100 }));
runCommand("f.patch.create", { sourceIds: ["S"], rows: 2, cols: 3, gap: [5, 8], order: "rows", colorGrouping: "byCopy" });
const ev = outside[0] as { groupId: string; overflow: [number, number]; propose: string } | undefined;
check(outside.length === 1 && !!ev && ev.groupId === group().id, "f.11 patch.outsideHoop is emitted for the group");
check(!!ev && near(ev.overflow[0], 40) && near(ev.overflow[1], 0), `f.11 overflow 40 mm in x (${ev?.overflow})`);
check(ev?.propose === "f.patch.center", "f.11 the event proposes f.patch.center");
past = s().past.length;
runCommand("f.patch.center", { groupId: group().id });
const centred = box(doc().objects.map((o) => o.id));
check(s().past.length === past + 1 && near(centred.x + centred.w / 2, 50) && near(centred.y + centred.h / 2, 50), `f.patch.center puts the footprint in the middle of the hoop, one undo step (${centred.x},${centred.y})`);
check(outside.length === 2 && near((outside[1] as typeof ev)!.overflow[0], 30), "a patch wider than the hoop after centring: outsideHoop again (15 mm a side, 30 in all)");

// ---- f.12 / f.13: source red + blue, 2 pieces
const rb = () => design([rect("R", 10, 10, 20, 20, "R"), rect("B", 12, 12, 16, 16, "B")]);
const seq = () =>
  doc()
    .objects.map((o) => {
      const c = group().cells.find((x) => x.objectIds.includes(o.id))!;
      return `${o.thread}${c.col}`;
    })
    .join(",");
s().setDoc(rb());
runCommand("f.patch.create", { sourceIds: ["R", "B"], rows: 1, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byColor" });
check(seq() === "R0,R1,B0,B1", `f.12 byColor: R0, R1, B0, B1 (${seq()})`);
check(colorChanges(doc(), group().id, "byColor") === 1, "f.12 one colour change");
s().setDoc(rb());
runCommand("f.patch.create", { sourceIds: ["R", "B"], rows: 1, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byCopy" });
check(seq() === "R0,B0,R1,B1", `f.13 byCopy: R0, B0, R1, B1 (${seq()})`);
check(colorChanges(doc(), group().id, "byCopy") === 3 && colorChanges(doc(), group().id, "byColor") === 1, "f.13 both counts: 3 by copy, 1 by colour");
past = s().past.length;
runCommand("f.patch.setColorGrouping", { groupId: group().id, mode: "byColor" });
check(seq() === "R0,R1,B0,B1" && group().colorGrouping === "byColor" && s().past.length === past + 1, "f.patch.setColorGrouping reorders, one undo step");
past = s().past.length;
runCommand("f.patch.setColorGrouping", { groupId: group().id, mode: "byColor" });
check(s().past.length === past, "the same grouping again: no undo step");
runCommand("f.patch.setColorGrouping", { groupId: group().id, mode: "byCopy" });
check(seq() === "R0,B0,R1,B1", "back to byCopy: each piece in its own order again");

// ---- f.14: in piece 1 the red object becomes green, then byColor
const red1 = cell(0, 1).objectIds.find((id) => byId(id).thread === "R")!;
s().updateObject(red1, { thread: "G" });
runCommand("f.patch.setColorGrouping", { groupId: group().id, mode: "byColor" });
check(seq() === "R0,B0,B1,G1", `f.14 R0, then B0 and B1 in the blue block, G1 in its own (${seq()})`);

// a later object enters the cell that holds its centre
const late = rect("L", 40, 14, 6, 6, "B");
s().addObjects([late]);
runCommand("f.patch.setColorGrouping", { groupId: group().id, mode: "byCopy" });
check(cell(0, 1).objectIds.includes("L"), "an object added later joins the cell of its centre");
check(seq() === "R0,B0,G1,B1,B1", `…and is sewn with its piece (${seq()})`);

// ---- f.15: 2×3, serpentine
s().setDoc(design([rect("S", 10, 10, 40, 30)]));
runCommand("f.patch.create", { sourceIds: ["S"], rows: 2, cols: 3, gap: [5, 8], order: "serpentine", colorGrouping: "byCopy" });
const cellsSewn = () =>
  doc()
    .objects.map((o) => group().cells.find((x) => x.objectIds.includes(o.id))!)
    .map((c) => `(${c.row},${c.col})`)
    .join(" ");
check(cellsSewn() === "(0,0) (0,1) (0,2) (1,2) (1,1) (1,0)", `f.15 serpentine order (${cellsSewn()})`);
runCommand("f.patch.setOrder", { groupId: group().id, order: "rows" });
check(cellsSewn() === "(0,0) (0,1) (0,2) (1,0) (1,1) (1,2)", `f.patch.setOrder rows (${cellsSewn()})`);

// ---- f.16: the satin width changed in piece (0,1): only that piece changes; no clone anywhere
const satin: DesignObject = {
  ...rect("T", 10, 10, 30, 0),
  paths: [{ closed: false, nodes: [{ p: [10, 10] }, { p: [40, 10] }] }],
  stitch: { type: "satin", ...defaultSatin(), width: 3 },
};
s().setDoc(design([satin]));
runCommand("f.patch.create", { sourceIds: ["T"], rows: 2, cols: 3, gap: [5, 8], order: "rows", colorGrouping: "byCopy" });
const before = new Map(doc().objects.map((o) => [o.id, JSON.stringify(o)]));
const target = cell(0, 1).objectIds[0];
const o01 = byId(target);
s().updateObject(target, { stitch: { ...o01.stitch, width: 5 } as DesignObject["stitch"] });
const changed = doc().objects.filter((o) => before.get(o.id) !== JSON.stringify(o)).map((o) => o.id);
check(changed.join() === target, `f.16 only piece (0,1) changes (${changed})`);
check(doc().objects.every((o) => !o.clone), "f.16 no object has a clone link");

// a source that is a linked clone: its copies are plain objects
s().setDoc(design([rect("A", 10, 10, 10, 10), { ...rect("C", 30, 10, 10, 10), clone: { of: "A", m: [1, 0, 0, 1, 20, 0], rot: 0 } }]));
runCommand("f.patch.create", { sourceIds: ["C"], rows: 1, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byCopy" });
check(doc().objects.filter((o) => o.id !== "C").every((o) => !o.clone), "f.16 the copies of a clone are independent");

// a deleted piece is forgotten
const gid = group().id;
s().set({ selection: cell(0, 1).objectIds });
s().deleteSelection();
runCommand("f.patch.setOrder", { groupId: gid, order: "serpentine" });
check(group().cells.find((c) => c.col === 1)!.objectIds.length === 0, "a deleted piece is dropped from its cell");

// bad requests change nothing
past = s().past.length;
runCommand("f.patch.create", { sourceIds: ["nothing"], rows: 2, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byCopy" });
runCommand("f.patch.create", { sourceIds: ["A"], rows: 1, cols: 1, gap: [5, 5], order: "rows", colorGrouping: "byCopy" });
runCommand("f.patch.create", { sourceIds: ["C"], rows: 2, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byCopy" });
check(s().past.length === past, "unknown sources, 1×1, or a source already in a patch: no change, no undo step");

offEv();
offInstall();
done("module f (patch)");

