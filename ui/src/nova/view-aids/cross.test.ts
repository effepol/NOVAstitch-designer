// Module c, the cursor cross: c.1–c.3 (zero tolerance at a tenth of a mm, each
// arm on its own) and m.7 (the cross follows the last click of module m's tools),
// through module 0's hook: the canvas tells the pointer, module c hears it.

import { check, done } from "../core/testkit";
import { activateDrawingTool, canvasPointer, setCanvasPointer, setFilumLastPoint, toolPointer, type ToolPointerEvent } from "../core/registry";
import { openPrefs } from "../core/prefs";
import { setLanguage } from "../core/i18n";
import type { DesignObject, Vec2 } from "../../types";
import { emptyDoc, useStore } from "../../store";
import { installSatinTools } from "../satin-tools/install";
import { crossArms, crossFor, tenth, type CrossArms } from "./cross";
import { createViewAids } from "./settings";
import { installViewAids } from "./install";

(async () => {
  const prev: Vec2 = [10, 20];

  // c.1
  let a: CrossArms & { shown?: boolean } = crossArms([10.04, 35.2], prev);
  check(a.vertical && !a.horizontal, "c.1 (10,04; 35,20) after (10,00; 20,00): vertical arm aligned, horizontal normal");
  // c.2
  a = crossArms([10.06, 35.2], prev);
  check(!a.vertical && !a.horizontal, "c.2 (10,06; 35,20): both arms normal (10,1 ≠ 10,0)");
  // c.3
  a = crossArms([42, 20.03], prev);
  check(!a.vertical && a.horizontal, "c.3 (42,00; 20,03): horizontal arm aligned, vertical normal");

  // both arms at once, and no previous point
  a = crossArms([10.01, 19.98], prev);
  check(a.vertical && a.horizontal, "both arms aligned on the same point (to the tenth)");
  a = crossArms([10, 20], null);
  check(!a.vertical && !a.horizontal, "no previous point: both arms normal");

  // the tenth is the DST's: values a floating point product puts just under .5 still round up
  check(tenth(10.05) === 101 && tenth(10.04) === 100 && tenth(0.15) === 2, "a tenth of a mm: 10,05 → 101, 10,04 → 100, 0,15 → 2");
  check(!crossArms([10.05, 0], prev).vertical, "10,05 is 10,1: not aligned with 10,00");

  // module c installed: it hears the canvas's pointer through module 0's hook
  setLanguage("en");
  const files = new Map<string, string>();
  const aids = createViewAids(await openPrefs({ read: async (n) => files.get(n) ?? null, write: async (n, x) => void files.set(n, x), rename: async (b, c) => void (files.set(c, files.get(b)!), files.delete(b)) }));
  const offC = installViewAids(aids);
  const cross = () => {
    const c = aids.cursor();
    return c ? crossFor({ tool: c.tool, cursor: c.mm, last: c.last }) : crossFor({ tool: "select", cursor: null, last: null });
  };

  // c.1–c.3 with Filum's pen: the last point comes from the canvas (setFilumLastPoint)
  let filumLast: Vec2 | null = [10, 20];
  setFilumLastPoint(() => filumLast);
  setCanvasPointer("pen", [10.04, 35.2]);
  a = cross();
  check(!!a.shown && a.vertical && !a.horizontal, "c.1 on the canvas with Filum's pen: vertical arm aligned");
  setCanvasPointer("pen", [10.06, 35.2]);
  a = cross();
  check(!!a.shown && !a.vertical && !a.horizontal, "c.2 on the canvas: both arms normal");
  setCanvasPointer("pen", [42, 20.03]);
  a = cross();
  check(!!a.shown && !a.vertical && a.horizontal, "c.3 on the canvas: horizontal arm aligned");
  filumLast = null;
  setCanvasPointer("pen", [10, 20]);
  a = cross();
  check(!!a.shown && !a.vertical && !a.horizontal, "not drawing: the cross is there, both arms normal");
  setCanvasPointer("pen", null);
  check(!aids.cursor() && !cross().shown, "the pointer left the canvas: no cross");

  // m.7: the cross works on the two-rail satin, from its last click
  const offM = installSatinTools();
  activateDrawingTool("m.twoRails");
  const ev = (kind: ToolPointerEvent["kind"], p: Vec2, button: 0 | 2 = 0): ToolPointerEvent => ({ kind, p, button, shift: false, alt: false, ctrl: false, scale: 4 });
  const click = (p: Vec2, button: 0 | 2 = 0) => {
    toolPointer("m.twoRails", ev("down", p, button));
    toolPointer("m.twoRails", ev("up", p, button));
  };
  setCanvasPointer("m.twoRails", [30, 40]);
  check(cross().shown && !cross().vertical && !cross().horizontal, "m.7 no click yet: the cross is there, no previous point");
  click([30, 40]);
  setCanvasPointer("m.twoRails", [30.03, 60]);
  a = cross();
  check(canvasPointer().registered && !!a.shown && a.vertical && !a.horizontal, "m.7 after one click: vertical arm aligned with the click");
  click([50, 40], 2);
  setCanvasPointer("m.twoRails", [70, 39.96]);
  a = cross();
  check(a.horizontal && !a.vertical, "m.7 after the second click: compared with the last click (50; 40)");
  setCanvasPointer("m.twoRails", null);

  // m.7 with «Dividi e dirigi»: while a line is drawn, the cross compares with where it started
  const square: DesignObject = {
    id: "Q",
    name: "Q",
    thread: "T1",
    visible: true,
    locked: false,
    paths: [{ closed: true, nodes: ([[0, 0], [40, 0], [40, 40], [0, 40]] as Vec2[]).map((p) => ({ p })) }],
    stitch: { type: "fill", method: "tatami", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, underlay: true } as DesignObject["stitch"],
    trimAfter: false,
    stopAfter: false,
  };
  useStore.getState().setDoc({ ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects: [square] });
  useStore.getState().select(["Q"]);
  activateDrawingTool("m.split");
  setCanvasPointer("m.split", [20, 10]);
  check(cross().shown && !cross().vertical && !cross().horizontal, "m.7 «Dividi e dirigi», no line yet: the cross is there, no previous point");
  toolPointer("m.split", ev("down", [20, 10]));
  toolPointer("m.split", ev("move", [20.04, 30]));
  setCanvasPointer("m.split", [20.04, 30]);
  a = cross();
  check(!!a.shown && a.vertical && !a.horizontal, "m.7 «Dividi e dirigi», a cut drawn downwards: vertical arm aligned with where it started");
  toolPointer("m.split", ev("move", [35, 10.03]));
  setCanvasPointer("m.split", [35, 10.03]);
  a = cross();
  check(a.horizontal && !a.vertical, "m.7 «Dividi e dirigi», drawn sideways: horizontal arm aligned");
  toolPointer("m.split", ev("up", [35, 10.03]));
  setCanvasPointer("m.split", null);
  activateDrawingTool("select");
  offM();
  offC();
  setFilumLastPoint(() => null);
  done("module c, cursor cross");
})();
