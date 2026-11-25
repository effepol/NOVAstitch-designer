// The canvas label (module 0, from the trials of build 1, Signor Poletti 25/11):
// with module c's cursor cross the label next to the cursor (penHint, the
// tooltip, the satin's width) covered the aiming point. Now it sits at the
// bottom of the canvas, centred, away from the cursor (at the top when the
// cursor is right there); it goes 10 s after the tool was chosen and comes
// back at every choice of a tool, the same one too. While a drag shows its
// values (Δ mm, angle), they stay.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HINT_MS, hintPosition, hintVisible, markToolPicked, onToolPicked } from "./canvasHint";
import { useStore } from "../../store";

check(HINT_MS === 10_000, "10 seconds");
markToolPicked(1000);
check(hintVisible(1000 + 9_999, false) && !hintVisible(1000 + 10_000, false), "shown for 10 s after the tool was chosen, then gone");
check(hintVisible(1000 + 60_000, true), "a drag's values stay while dragging");
let heard = 0;
const off = onToolPicked(() => heard++);
const st = useStore.getState();
st.setTool("pen");
const t1 = Date.now();
check(heard === 1 && hintVisible(t1 + 5_000, false), "choosing a tool starts the 10 s again");
st.setTool("pen");
check(heard === 2, "choosing the same tool again counts too");
off();

// the place: bottom centre of the canvas, away from the cursor
const p = hintPosition(1000, 600, 200, [100, 100]);
check(Math.abs(p.x + 100 - 500) < 1e-9 && p.y > 600 - 40 && p.y < 600, "bottom of the canvas, centred");
const near = hintPosition(1000, 600, 200, [500, 590]);
check(near.y < 60, "when the cursor is on the bottom centre, it goes to the top centre");
const far = hintPosition(1000, 600, 200, [100, 590]);
check(far.y > 560, "a cursor at the bottom but to the side does not move it");

const canvas = readFileSync(path.join(process.cwd(), "src", "canvas", "Canvas.tsx"), "utf8");
check(/tooltip: hintVisible\(Date\.now\(\), !!dragRef\.current\) \? iRef\.current\.tooltip : null/.test(canvas) && /onToolPicked\(/.test(canvas), "the canvas shows the label by that rule and redraws when the 10 s are over");
const interactive = readFileSync(path.join(process.cwd(), "src", "canvas", "interactive.ts"), "utf8");
check(/hintPosition\(/.test(interactive) && !/const sx = px \+ 14/.test(interactive), "the label is drawn at that place, no longer next to the cursor");
const store = readFileSync(path.join(process.cwd(), "src", "store.ts"), "utf8");
check(/setTool: \(tool\) => \{\s*markToolPicked\(\);/.test(store), "store.setTool marks every choice of a tool");

done("etichetta della tela");
