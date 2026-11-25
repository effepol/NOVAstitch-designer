// Start / end pins (S, E) on the canvas (module 0, from the trials of build 1,
// Signor Poletti 25/11): the area that takes the mouse was a circle of 8 px
// around the pin's tip, while the pin is drawn as a drop above it (its letter
// about 12 px above the tip), so a click on the letter missed. Now a circle
// of 11 px around the pin's head takes it too; the pin is drawn as before.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { handleHit, HANDLE_HIT_PX, PIN_HEAD_PX, PIN_HIT_PX, type Handle } from "../../canvas/handles";

const scale = 4; // px per mm
const at = (h: Handle, dx: number, dy: number) => handleHit(h, [h.p[0] + dx / scale, h.p[1] + dy / scale], scale);
const start: Handle = { kind: "start", objId: "o", p: [10, 10] };
const end: Handle = { kind: "end", objId: "o", p: [30, 10] };

check(PIN_HIT_PX >= 10 && PIN_HIT_PX <= 12, `the pin's head takes the mouse within ${PIN_HIT_PX} px (10–12 asked)`);
check(Math.abs(PIN_HEAD_PX - 8 * 1.55) < 1e-9, "the head is where the letter is drawn (1.55 × 8 px above the tip)");
for (const h of [start, end]) {
  const k = h.kind.toUpperCase().slice(0, 1);
  check(at(h, 0, -PIN_HEAD_PX), `${k}: a click on the letter takes the pin`);
  check(at(h, 0, 0) && at(h, 7, 0), `${k}: the tip as before (within ${HANDLE_HIT_PX} px)`);
  check(at(h, 10.5, -PIN_HEAD_PX) && at(h, -10.5, -PIN_HEAD_PX) && at(h, 0, -PIN_HEAD_PX - 10.5), `${k}: 10.5 px around the head takes it`);
  check(!at(h, 14, -PIN_HEAD_PX) && !at(h, 0, -PIN_HEAD_PX - 14) && !at(h, 12, 4), `${k}: 14 px from the head, or off to the side of the tip, does not`);
}
// the other handles keep Filum's 8 px around their point
const angle: Handle = { kind: "angle", objId: "o", p: [10, 10] };
check(at(angle, 7, 0) && !at(angle, 0, -PIN_HEAD_PX), "other handles: 8 px around their point, as before");

const canvas = readFileSync(path.join(process.cwd(), "src", "canvas", "Canvas.tsx"), "utf8");
check((canvas.match(/handleHit\(h, p, s\.view\.scale\)/g) ?? []).length === 2 && !/dist\(h\.p, p\) < HANDLE_HIT_PX/.test(canvas), "the canvas uses it for the press and for the hover");
const interactive = readFileSync(path.join(process.cwd(), "src", "canvas", "interactive.ts"), "utf8");
check(/const r = 8 \/ scale;/.test(interactive) && /ctx\.fillText\(letter, p\[0\], p\[1\] - r \* 1\.55\);/.test(interactive), "the pin is drawn as before");

done("segnalini di partenza e arrivo");
