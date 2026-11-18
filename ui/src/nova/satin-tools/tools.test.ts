// Module m on the canvas: the two tools come from module 0's drawing tool
// registry. Clicks, the right button, Enter, Esc and Backspace go to them; the
// preview draws square points (rail 1 blue, rail 2 orange), grey dashed rungs,
// brown cut lines and red direction lines. m.1–m.3 and m.8 through the tool,
// m.4–m.6 through «Dividi e dirigi», Assisted rules.

import { check, done } from "../core/testkit";
import { useStore, emptyDoc } from "../../store";
import type { DesignObject, StitchDocument, Vec2 } from "../../types";
import { activateDrawingTool, drawCanvasLayers, drawingCursor, drawingTool, drawingTools, toolKey, toolPointer, type ToolPointerEvent } from "../core/registry";
import { setModeSource } from "../core/mode";
import { setLanguage } from "../core/i18n";
import { isRailSatin } from "../../lib/nodeOps";
import { installSatinTools } from "./install";
import { COLORS } from "./tools";

const s = () => useStore.getState();
const doc = () => s().doc;
setLanguage("en");
const off = installSatinTools();

const ev = (kind: ToolPointerEvent["kind"], p: Vec2, button: 0 | 2 = 0): ToolPointerEvent => ({ kind, p, button, shift: false, alt: false, ctrl: false, scale: 4 });
const click = (tool: string, p: Vec2, button: 0 | 2 = 0) => {
  toolPointer(tool, ev("down", p, button));
  toolPointer(tool, ev("up", p, button));
};
const drag = (tool: string, a: Vec2, b: Vec2, button: 0 | 2 = 0) => {
  toolPointer(tool, ev("down", a, button));
  toolPointer(tool, ev("move", b, button));
  toolPointer(tool, ev("up", b, button));
};
const toasts = () => s().toasts.map((x) => x.text);
function start(objects: DesignObject[] = []): void {
  const d: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }, { id: "T2", name: "Blu", color: "#0000cc", brand: "", code: "" }], objects };
  s().setDoc(d);
  s().set({ selection: [], toasts: [], activeThread: null } as never);
}
/** A canvas that records what is drawn: fills (with their colour and shape), strokes (colour, dash). */
function fakeCtx() {
  const log: { op: string; color: string; dash: number }[] = [];
  let dash: number[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    rect() {},
    stroke() {
      log.push({ op: "stroke", color: String(ctx.strokeStyle), dash: dash.length });
    },
    fill() {
      log.push({ op: "fill", color: String(ctx.fillStyle), dash: 0 });
    },
    fillRect() {
      log.push({ op: "square", color: String(ctx.fillStyle), dash: 0 });
    },
    strokeRect() {
      log.push({ op: "squareEdge", color: String(ctx.strokeStyle), dash: 0 });
    },
    setLineDash(d: number[]) {
      dash = d;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

// --- the tools are in the registry --------------------------------------------
check(!!drawingTool("m.twoRails") && !!drawingTool("m.split"), "both tools are registered drawing tools");
check(drawingTools().filter((x) => x.module === "m").length === 2, "module m adds two tools to the rail");
check(drawingTool("m.twoRails")?.crosshair !== false && drawingTool("m.split")?.crosshair !== false, "module c's cross will apply to both");

// --- m.1 through the tool -------------------------------------------------------
start();
s().set({ activeThread: "T2" } as never);
s().setTool("m.twoRails" as never);
activateDrawingTool("m.twoRails");
const S1: Vec2 = [10, 10];
const D1: Vec2 = [20, 12];
const S2: Vec2 = [8, 40];
const D2: Vec2 = [30, 38];
for (const p of [S1, D1, S2, D2]) click("m.twoRails", p);
check(drawingCursor("m.twoRails").last?.join() === D2.join(), "the last click is the cross's previous point (m.7 hook)");
const { ctx, log } = fakeCtx();
drawCanvasLayers(ctx, { scale: 4, ox: 0, oy: 0 }, "over");
const squares = log.filter((x) => x.op === "square");
check(squares.length === 4, `preview: four square points (${squares.length})`);
check(squares.filter((x) => x.color === COLORS.rail1).length === 2 && squares.filter((x) => x.color === COLORS.rail2).length === 2, "preview: two blue and two orange");
check(log.some((x) => x.op === "stroke" && x.color === COLORS.rung && x.dash > 0), "preview: grey dashed rungs");
check(log.some((x) => x.op === "stroke" && x.color === COLORS.rail1 && x.dash === 0) && log.some((x) => x.op === "stroke" && x.color === COLORS.rail2 && x.dash === 0), "preview: the rails, blue and orange");
check(toolKey("m.twoRails", "Enter") === true, "Enter is used by the tool");
check(doc().objects.length === 1 && isRailSatin(doc().objects[0]), "m.1: Enter makes a two-rail satin");
check(doc().objects[0]?.thread === "T2", "the satin takes the active thread");
check(s().selection.join() === doc().objects[0]?.id, "the new satin is selected");
check(drawingCursor("m.twoRails").last === null, "after Enter the drawing starts again");
s().undo();
check(doc().objects.length === 0, "m.1: one Annulla removes it");

// --- m.2 ------------------------------------------------------------------------
start();
for (const p of [S1, D1, S2, D2, [5, 60] as Vec2]) click("m.twoRails", p);
toolKey("m.twoRails", "Enter");
check(doc().objects.length === 1 && doc().objects[0].paths.every((sp) => sp.nodes.length === 2), "m.2: a satin with two pairs");
check(toasts().some((x) => x.startsWith("Odd number of clicks")), "m.2: the warning is shown");

// --- m.3 ------------------------------------------------------------------------
start();
for (const p of [S1, D1, S2]) click("m.twoRails", p);
check(toolKey("m.twoRails", "Escape") === true, "m.3: Esc during the drawing is used by the tool");
check(doc().objects.length === 0 && drawingCursor("m.twoRails").last === null, "m.3: no object, the drawing is gone");
check(toolKey("m.twoRails", "Escape") === false, "Esc with nothing drawn goes back to Filum (Selection)");
// Backspace takes back the last point
for (const p of [S1, D1, S2]) click("m.twoRails", p);
check(toolKey("m.twoRails", "Backspace") === true && drawingCursor("m.twoRails").last?.join() === D1.join(), "Backspace takes back the last point");
toolKey("m.twoRails", "Escape");
// leaving the tool drops the half-drawn satin
click("m.twoRails", S1);
activateDrawingTool("select");
activateDrawingTool("m.twoRails");
check(drawingCursor("m.twoRails").last === null, "leaving the tool drops what was half drawn");

// --- m.8 ------------------------------------------------------------------------
start();
click("m.twoRails", S1);
click("m.twoRails", D1);
click("m.twoRails", S2, 2);
click("m.twoRails", D2, 2);
click("m.twoRails", [12, 70]);
click("m.twoRails", [26, 72]);
toolKey("m.twoRails", "Enter");
const o8 = doc().objects[0];
check(!!o8 && o8.paths.every((sp) => sp.nodes.map((n) => !!(n.i && n.o)).join() === "false,true,false"), "m.8: right click on S2 and D2 curves the rails there, straight elsewhere");

// --- Assisted: the two-rail tool is Studio's ---------------------------------------
start();
setModeSource(() => "assisted");
s().setTool("m.twoRails" as never);
activateDrawingTool("select");
activateDrawingTool("m.twoRails");
check(s().tool === "select" && toasts().some((x) => x.includes("Studio")), "in Assisted the two-rail tool is not available (back to Selection, a note)");
setModeSource(null);

// --- «Dividi e dirigi» ------------------------------------------------------------
const ring = (pts: Vec2[]) => ({ closed: true, nodes: pts.map((p) => ({ p })) });
const A: DesignObject = {
  id: "A",
  name: "A",
  thread: "T1",
  visible: true,
  locked: false,
  paths: [
    ring([
      [0, 0],
      [3, 0],
      [3.9, 3],
      [8.1, 3],
      [9, 0],
      [12, 0],
      [7.5, 15],
      [4.5, 15],
    ]),
    ring([
      [4.5, 5],
      [6, 10],
      [7.5, 5],
    ]),
  ],
  stitch: { type: "fill", method: "tatami", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, underlay: true } as DesignObject["stitch"],
  trimAfter: false,
  stopAfter: false,
};
start([A]);
activateDrawingTool("select");
s().setTool("m.split" as never);
activateDrawingTool("m.split");
click("m.split", [6, 6]);
check(toasts().some((x) => x.startsWith("Select a filled shape")), "with nothing selected the tool asks for a shape");
s().set({ toasts: [] } as never);
s().select(["A"]);
// left drag = cut (brown), right drag = direction (red)
drag("m.split", [-1, 7], [13, 7]);
drag("m.split", [6, -1], [6, 6]);
drag("m.split", [6, 11], [6, 14], 2);
drag("m.split", [0.5, 2], [3, 2], 2);
drag("m.split", [11.5, 2], [9, 2], 2);
click("m.split", [20, 20]); // a click without dragging adds no line
const c2 = fakeCtx();
drawCanvasLayers(c2.ctx, { scale: 4, ox: 0, oy: 0 }, "over");
check(c2.log.filter((x) => x.op === "stroke" && x.color === COLORS.cut).length === 2, "two brown cut lines in the preview");
check(c2.log.filter((x) => x.op === "stroke" && x.color === COLORS.direction).length === 3, "three red direction lines in the preview");
check(toolKey("m.split", "Enter") === true, "Enter applies");
check(doc().objects.length === 3 && doc().objects.every((o) => isRailSatin(o)), "m.4 through the tool: three satins");
check(toasts().length === 0, "every part had its line: no warning");
s().undo();
check(doc().objects.length === 1 && doc().objects[0].id === "A", "m.5: one Annulla brings back the A");

// m.6: one part without a line → warning in Studio
s().select(["A"]);
drag("m.split", [-1, 7], [13, 7]);
drag("m.split", [6, 11], [6, 14], 2);
toolKey("m.split", "Enter");
check(doc().objects.length === 2 && toasts().some((x) => x.startsWith("One or more parts have no direction line")), "m.6: a part without a line, warning in Studio");
s().undo();

// Esc drops the lines, Backspace the last one
s().select(["A"]);
drag("m.split", [-1, 7], [13, 7]);
drag("m.split", [6, -1], [6, 6]);
check(toolKey("m.split", "Backspace") === true, "Backspace takes back the last line");
check(toolKey("m.split", "Escape") === true && toolKey("m.split", "Escape") === false, "Esc drops the lines, then goes back to Filum");
check(toolKey("m.split", "Enter") === false, "Enter with no lines is not used");
check(doc().objects.length === 1 && doc().objects[0].id === "A", "Esc, then Enter: nothing changed");

// Assisted: only cuts, the direction is automatic, no warning
setModeSource(() => "assisted");
s().set({ toasts: [] } as never);
s().select(["A"]);
drag("m.split", [-1, 7], [13, 7]);
drag("m.split", [6, 11], [6, 14], 2); // the right button draws no red line in Assisted
const c3 = fakeCtx();
drawCanvasLayers(c3.ctx, { scale: 4, ox: 0, oy: 0 }, "over");
check(!c3.log.some((x) => x.color === COLORS.direction), "Assisted: no red lines");
toolKey("m.split", "Enter");
check(doc().objects.length === 2 && !toasts().some((x) => x.startsWith("One or more parts have no direction line")), "Assisted: the parts get the automatic direction, without the Studio warning");
setModeSource(null);

activateDrawingTool("select");
off();
check(!drawingTool("m.twoRails") && !drawingTool("m.split"), "uninstalling removes the tools");
done("module m on the canvas");
