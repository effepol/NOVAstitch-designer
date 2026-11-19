// Clicks on the canvas layers (module 0, for module b, request of 19/11):
// a registered layer may answer hit(p, info) (p in the design's mm, tolerance
// of a few pixels: info.tol) and onClick(p, info, clientX, clientY). With the
// select tool and the left button, a click on a layer that is ON and answers
// hit = true goes to it, not to Filum's selection. A layer that is off, a click
// out of tolerance, other tools, a drag and the right button: as today.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Vec2 } from "../../types";
import { drawCanvasLayers, layerClick, registerCanvasLayer, type LayerHitInfo } from "./registry";

// a horizontal line y = 10 from x = 0 to x = 50 (mm); the view: 4 px per mm
const scale = 4;
const info = { scale, ox: 0, oy: 0 };
const clicks: { p: Vec2; x: number; y: number }[] = [];
let on = true;
const distToLine = (p: Vec2) => (p[0] < 0 ? Math.hypot(p[0], p[1] - 10) : p[0] > 50 ? Math.hypot(p[0] - 50, p[1] - 10) : Math.abs(p[1] - 10));
const off = registerCanvasLayer({
  id: "b.links",
  module: "b",
  visible: () => on,
  draw: () => {},
  hit: (p: Vec2, i: LayerHitInfo) => distToLine(p) <= i.tol,
  onClick: (p: Vec2, _i: LayerHitInfo, x: number, y: number) => void clicks.push({ p, x, y }),
});

check(layerClick([20, 10], info, 100, 200) && clicks.length === 1 && clicks[0].x === 100 && clicks[0].y === 200, "layer on + click on the line: onClick gets it (the client point too)");
check(layerClick([20, 10.5], info, 0, 0) && clicks.length === 2, "a click a couple of pixels off the line still hits");
check(!layerClick([20, 10 + 10 / scale], info, 0, 0) && clicks.length === 2, "a click 10 px from the line: Filum's selection");
on = false;
check(!layerClick([20, 10], info, 0, 0) && clicks.length === 2, "layer off: Filum's selection");
let drawn = 0;
const off2 = registerCanvasLayer({ id: "b.drawn", module: "b", visible: () => on, draw: () => void drawn++ });
drawCanvasLayers({ save() {}, restore() {} } as unknown as CanvasRenderingContext2D, info);
check(drawn === 0, "a layer that is off is not drawn either");
on = true;
drawCanvasLayers({ save() {}, restore() {} } as unknown as CanvasRenderingContext2D, info);
check(drawn === 1, "on again: drawn");
off2();

// the tolerance the layer is given: a few pixels, in mm
let seen: LayerHitInfo | null = null;
const off3 = registerCanvasLayer({ id: "b.probe", module: "b", draw: () => {}, hit: (_p, i) => ((seen = i), false), onClick: () => {} });
layerClick([0, 0], info, 0, 0);
check(!!seen && Math.abs((seen as LayerHitInfo).tol * scale - 6) < 1e-9, "info.tol = 6 px in mm (Filum's click tolerance)");
off3();

// a layer that fails does not take the click away from Filum
const off4 = registerCanvasLayer({ id: "x.bad", module: "x", draw: () => {}, hit: () => { throw new Error("boom"); } });
const err = console.error;
console.error = () => {};
on = false;
check(!layerClick([20, 10], info, 0, 0), "a layer whose hit fails: Filum's selection");
console.error = err;
off4();
on = true;
off();
check(!layerClick([20, 10], info, 0, 0), "removed: Filum's selection");

// Canvas.tsx: the select tool, left button only; a drag that starts on the layer is Filum's
const src = readFileSync(path.join(process.cwd(), "src", "canvas", "Canvas.tsx"), "utf8");
const sel = src.slice(src.indexOf('case "select": {'), src.indexOf('case "select": {') + 600);
check(/layerPressRef\.current = \{/.test(sel) && /layerHit\(/.test(sel), "Canvas: with the select tool a press on a layer that answers hit is kept for the release");
check(/e\.button === 1 \|\| e\.button === 2[^\n]*\n[^\n]*pan/.test(src.slice(src.indexOf("const onPointerDown"), src.indexOf('case "select": {'))), "Canvas: the right and middle buttons pan before the layers are asked (as today)");
check(/layerPressRef\.current[\s\S]{0,400}CLICK_SLOP[\s\S]{0,400}onPointerDown\(/.test(src.slice(src.indexOf("const onPointerMove"))), "Canvas: a drag from the layer replays Filum's press (selection, move, marquee as today)");
check(/layerPressRef\.current[\s\S]{0,300}layerClick\(/.test(src.slice(src.indexOf("const onPointerUp"))), "Canvas: released without moving: the layer's onClick");

done("clic sui livelli della tela");
