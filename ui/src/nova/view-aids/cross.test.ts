// Module c, the cursor cross: c.1–c.3 (zero tolerance at a tenth of a mm, each
// arm on its own) and m.7 (the cross follows the last click of module m's tools).

import { check, done } from "../core/testkit";
import { activateDrawingTool, toolPointer, type ToolPointerEvent } from "../core/registry";
import { setLanguage } from "../core/i18n";
import type { Vec2 } from "../../types";
import { installSatinTools } from "../satin-tools/install";
import { crossArms, crossFor, setTracePoint, tenth, type CrossArms } from "./cross";

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

// Filum's own tools: the previous point comes from module 0's hook (setTracePoint)
setTracePoint(() => [5, 5]);
a = crossFor("pen", [5.02, 9]);
check(a.vertical && !a.horizontal && !!a.shown, "Filum's tools: the previous point comes from the trace hook");
setTracePoint(null);
check(!crossFor("pen", [5, 5]).vertical, "without the hook (nor a registered tool) no previous point");

// m.7: the cross works on the two-rail satin, from its last click
setLanguage("en");
const off = installSatinTools();
activateDrawingTool("m.twoRails");
const ev = (kind: ToolPointerEvent["kind"], p: Vec2, button: 0 | 2 = 0): ToolPointerEvent => ({ kind, p, button, shift: false, alt: false, ctrl: false, scale: 4 });
const click = (p: Vec2, button: 0 | 2 = 0) => {
  toolPointer("m.twoRails", ev("down", p, button));
  toolPointer("m.twoRails", ev("up", p, button));
};
check(!crossFor("m.twoRails", [30, 40]).vertical, "m.7 no click yet: no previous point");
click([30, 40]);
a = crossFor("m.twoRails", [30.03, 60]);
check(!!a.shown && a.vertical && !a.horizontal, "m.7 after one click: vertical arm aligned with the click");
click([50, 40], 2);
a = crossFor("m.twoRails", [70, 39.96]);
check(a.horizontal && !a.vertical, "m.7 after the second click: compared with the last click (50; 40)");
activateDrawingTool("select");
off();
done("module c, cursor cross");
