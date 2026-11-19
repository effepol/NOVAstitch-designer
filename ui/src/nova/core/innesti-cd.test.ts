// Hook points for modules c and d (Architect, 18/11): the 1× zoom from a registered
// screen scale and the zoom buttons; where the pointer and the last point are while
// drawing (module c's cross); a module's needle path in place of Filum's stitch line.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  activateDrawingTool, activeStitchLine, canvasPointer, drawStitchLine, oneToOneScale, onCanvasPointer, registerDrawingTool,
  registerScreenScale, registerStitchLine, setCanvasPointer, setFilumLastPoint, setSystemCursorHidden, systemCursorHidden,
} from "./registry";
import type { Vec2 } from "../../types";

const src = path.resolve(process.cwd(), "src");
const read = (f: string) => readFileSync(path.join(src, f), "utf8");

// ---- 1) zoom: 1× from a registered screen scale, else 96/25.4
check(Math.abs(oneToOneScale() - 96 / 25.4) < 1e-12, "without a registered screen scale 1× is 96/25.4 px per mm");
let px: number | null = 3.788;
const offScale = registerScreenScale({ id: "test.screen", module: "test", pxPerMm: () => px });
check(oneToOneScale() === 3.788, "with module c's calibration 1× is its pxPerMm");
px = null;
check(Math.abs(oneToOneScale() - 96 / 25.4) < 1e-12, "a module without a calibration yet: 96/25.4");
offScale();
const bar = read("components/BottomBar.tsx");
check(/const zooms = \[0\.5, 1, 2, 4, 6\]/.test(bar), "the zoom buttons: 0.5×, 1×, 2×, 4×, 6× (no 3×; «fit» stays before them)");
check(/data-nova=\{z === 2 \|\| z === 4 \? "core" : undefined\}/.test(bar), "the new 2× and 4× are marked data-nova=\"core\"");
check(/z === 2 \|\| z === 4 \? coreT\("core\.zoom\.title", \{ z \}\)/.test(bar), "the 2× and 4× titles are module 0's own texts (marked elements carry no Filum text: i.3, i.1)");
check(/oneToOneScale\(\)/.test(bar) && /oneToOneScale\(\)/.test(read("canvas/Canvas.tsx")) && /oneToOneScale\(\)/.test(read("nova/core/bridge.ts")), "the bar, the canvas zoom and view.changed take 1× from oneToOneScale()");

// ---- 2) the cursor cross: pointer and last point in mm, for Filum's tools and the registered ones
const seen: unknown[] = [];
const offSeen = onCanvasPointer((p) => seen.push(p));
let filumLast: Vec2 | null = [10, 20];
setFilumLastPoint(() => filumLast);
setCanvasPointer("pen", [10.04, 35.2]);
check(JSON.stringify(canvasPointer()) === JSON.stringify({ tool: "pen", registered: false, cursor: [10.04, 35.2], last: [10, 20], drawing: true }), `drawing with Filum's pen: cursor and last point (${JSON.stringify(canvasPointer())})`);
filumLast = null;
setCanvasPointer("select", [1, 1]);
check(canvasPointer().last === null && !canvasPointer().drawing, "not drawing: no last point");
let regLast: Vec2 | null = [5, 6];
const offTool = registerDrawingTool({ id: "test.rails", module: "test", label: "x", icon: () => null, onPointer: () => {}, lastPoint: () => regLast });
activateDrawingTool("test.rails");
setCanvasPointer("test.rails", [7, 8]);
check(JSON.stringify(canvasPointer()) === JSON.stringify({ tool: "test.rails", registered: true, cursor: [7, 8], last: [5, 6], drawing: true }), "drawing with a registered tool: its last point");
regLast = null;
setCanvasPointer("test.rails", null);
check(canvasPointer().cursor === null, "the pointer left the canvas: no cursor");
check(seen.length === 4, `modules hear every change (${seen.length})`);
offSeen();
offTool();
activateDrawingTool("select");
setSystemCursorHidden(true);
check(systemCursorHidden(), "a module can hide the system cursor while its cross is on");
setSystemCursorHidden(false);
const canvas = read("canvas/Canvas.tsx");
check(/setCanvasPointer\(s\.tool, p\)/.test(canvas) && /setCanvasPointer\(useStore\.getState\(\)\.tool, null\)/.test(canvas), "Canvas.tsx: the pointer is told on every move and when it leaves");
check(/setFilumLastPoint\(/.test(canvas) && /penRef\.current/.test(canvas.slice(canvas.indexOf("setFilumLastPoint("), canvas.indexOf("setFilumLastPoint(") + 600)), "Canvas.tsx: Filum's last point comes from the pen, curve and satin draft, freehand and shapes");
check(/nova-no-cursor/.test(canvas) && /\.nova-no-cursor/.test(read("styles.css")), "Canvas.tsx / styles.css: the system cursor hides when asked");

// ---- 3) the needle path: a module's line in place of Filum's stitch line
check(activeStitchLine() === undefined, "no module: Filum's stitch view");
let on = false;
const drawn: string[] = [];
const offLine = registerStitchLine({ id: "test.needle", module: "test", active: () => on, draw: () => void drawn.push("needle") });
check(activeStitchLine() === undefined, "the module's option off: Filum's stitch line, as it is");
on = true;
check(activeStitchLine()?.id === "test.needle", "the option on: the module's line replaces Filum's");
drawStitchLine({} as CanvasRenderingContext2D, { scale: 1, ox: 0, oy: 0 }, {} as never, 10);
check(drawn.join() === "needle", "and the module draws it");
offLine();
check(/activeStitchLine\(\)/.test(canvas) && /noStitches/.test(canvas), "Canvas.tsx: with the needle path on, neither WebGL nor the 2D canvas draws Filum's stitch line");
const render = read("canvas/render.ts");
check(/!r\.noStitches/.test(render) && /drawStitchLine\(/.test(render) && /r\.noStitches,/.test(render), "render.ts: Filum's line left out, the module's drawn, the kept background repainted when it switches");

// ---- 4) (18/11 evening) a bar button may carry a lesson anchor: BottomBar puts it as data-nova-anchor
check(/data-nova-anchor=\{b\.anchor\}/.test(bar), "BottomBar.tsx: a registered button's anchor becomes its data-nova-anchor (for the lessons)");
check(/anchor\?: string;/.test(read("nova/core/registry.ts").slice(read("nova/core/registry.ts").indexOf("export interface ToolbarButtonEntry"), read("nova/core/registry.ts").indexOf("export interface ToolbarButtonEntry") + 600)), "registry.ts: ToolbarButtonEntry has an optional anchor");

done("hook points for c and d");
