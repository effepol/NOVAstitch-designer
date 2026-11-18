// Registry of drawing tools (Architect, 18/11): a module registers a tool (id, icon, label,
// pointer events on the canvas, right button included and without Filum's menu, a preview
// it draws, Enter/Esc) and it appears among Filum's tools, marked data-nova. Module c's
// cursor cross hooks onto it later (drawingCursor). Filum's own tools stay as they are.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { activateDrawingTool, drawCanvasLayers, drawingCursor, drawingTool, drawingTools, registerDrawingTool, toolKey, toolPointer, type ToolPointerEvent } from "./registry";
import type { Vec2 } from "../../types";

const Icon = () => null;
const got: string[] = [];
let last: Vec2 | null = null;
const off = registerDrawingTool({
  id: "test.rails",
  module: "test",
  label: "test.rails",
  icon: Icon,
  order: 2,
  onPointer: (e: ToolPointerEvent) => {
    got.push(`${e.kind}:${e.button}:${e.p.join(",")}`);
    if (e.kind === "down") last = e.p;
  },
  onKey: (k) => (got.push(`key:${k}`), k !== "Backspace"),
  drawPreview: () => void got.push("preview"),
  onDeactivate: () => void got.push("deactivate"),
  lastPoint: () => last,
});
registerDrawingTool({ id: "test.first", module: "test", label: "test.first", icon: Icon, order: 1, onPointer: () => {} });

check(drawingTools().map((x) => x.id).join() === "test.first,test.rails", "tools are listed in order");
check(drawingTool("test.rails")?.module === "test" && drawingTool("select") === undefined, "a registered tool is found by id; Filum's tools are not in the registry");
let dup = "";
try {
  registerDrawingTool({ id: "test.rails", module: "other", label: "x", icon: Icon, onPointer: () => {} });
} catch (e) {
  dup = (e as Error).message;
}
check(dup.includes("test.rails") && dup.includes("other"), `a duplicate id is refused, naming the module ("${dup}")`);

// pointer events: only to the active registered tool, left and right buttons
check(!toolPointer("select", { kind: "down", p: [1, 2], button: 0, shift: false, alt: false, ctrl: false, scale: 1 }), "with a Filum tool nothing is delivered");
activateDrawingTool("test.rails");
check(toolPointer("test.rails", { kind: "down", p: [10, 20], button: 0, shift: false, alt: false, ctrl: false, scale: 1 }), "left click delivered");
check(toolPointer("test.rails", { kind: "down", p: [30, 20], button: 2, shift: false, alt: false, ctrl: false, scale: 1 }), "right click delivered");
toolPointer("test.rails", { kind: "move", p: [31, 20], button: 0, shift: false, alt: false, ctrl: false, scale: 1 });
check(got.join("|") === "down:0:10,20|down:2:30,20|move:0:31,20", `events arrive in order (${got.join("|")})`);

// keys: Enter and Esc go to the tool; it says whether it used them
got.length = 0;
check(toolKey("test.rails", "Enter") && toolKey("test.rails", "Escape") && !toolKey("test.rails", "Backspace"), "Enter and Esc reach the tool, which says whether it used them");
check(!toolKey("pen", "Enter"), "a Filum tool's keys stay Filum's");

// preview: drawn with the over layers, only for the active tool
got.length = 0;
drawCanvasLayers({} as CanvasRenderingContext2D, { scale: 1, ox: 0, oy: 0 }, "over");
check(got.join() === "preview", "the active tool draws its preview over the design");
got.length = 0;
drawCanvasLayers({} as CanvasRenderingContext2D, { scale: 1, ox: 0, oy: 0 }, "under");
check(got.length === 0, "…not under it");

// module c's cross: whether the tool takes it and the previous point
const c = drawingCursor("test.rails");
check(c.registered && c.crosshair && JSON.stringify(c.last) === "[30,20]", `drawingCursor gives module c the previous point (${JSON.stringify(c)})`);
check(!drawingCursor("select").registered, "for Filum's tools drawingCursor says it is not a registered tool");

// leaving the tool: it is told (to drop a half-drawn shape)
got.length = 0;
activateDrawingTool("select");
check(got.join() === "deactivate", "switching to another tool deactivates it");
got.length = 0;
drawCanvasLayers({} as CanvasRenderingContext2D, { scale: 1, ox: 0, oy: 0 }, "over");
check(got.length === 0, "an inactive tool draws no preview");
off();
check(!drawingTool("test.rails"), "unregistering removes it");

// the hook points in Filum's files
const src = path.resolve(process.cwd(), "src");
const read = (f: string) => readFileSync(path.join(src, f), "utf8");
const bars = read("components/Bars.tsx");
check(/drawingTools\(\)/.test(bars) && /data-nova=\{d\.module\}/.test(bars), "Bars.tsx: the registered tools are in Filum's tool rail, marked data-nova");
const canvas = read("canvas/Canvas.tsx");
check(/toolPointer\(/.test(canvas) && /toolKey\(/.test(canvas) && /activateDrawingTool\(/.test(canvas), "Canvas.tsx: pointer events, keys and tool changes reach the registry");
check(/onContextMenu[\s\S]{0,200}drawingTool\(/.test(canvas), "Canvas.tsx: no context menu on the right button of a registered tool");
check(/\$\{string\}\.\$\{string\}/.test(read("types.ts")), "types.ts: a tool can be a registered one (\"<module>.<name>\")");
// Filum's global keys (App.tsx) leave Esc, Backspace and Delete to the canvas while a registered tool is active
// (before: Esc switched to Select and Backspace deleted the selection, and the tool never got them)
check(/drawingTool\(s\.tool\)[\s\S]{0,160}(escape|backspace)/.test(read("App.tsx")), "App.tsx: Esc and Backspace reach a registered tool, not Filum's shortcuts");
check(/toolKey\([\s\S]{0,240}setTool\("select"\)/.test(canvas), "Canvas.tsx: Esc the tool does not use goes back to Select, as in Filum");

done("drawing tools");
