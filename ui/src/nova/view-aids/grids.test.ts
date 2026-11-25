// Module c, grids: c.7 (target grid on a 100 × 100 hoop, every 10 mm) and c.8
// (the grid step changed from 10 to 2 mm from the bar: Filum's grid draws its
// lines every 2 mm, the document does not change, no undo step).

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { openPrefs } from "../core/prefs";
import { toolbarButtons } from "../core/registry";
import { setLanguage, t } from "../core/i18n";
import { drawTarget, targetGrid } from "./grids";
import { createViewAids } from "./settings";
import { installViewAids } from "./install";

(async () => {

const hoop = { name: "100", width: 100, height: 100 };

// c.7
const tg = targetGrid(hoop, 10);
check(tg.center[0] === 50 && tg.center[1] === 50, "c.7 axes X and Y through the centre (50, 50)");
check(tg.circles.map((c) => c.r).join() === "10,20,30,40,50,60,70", `c.7 circles of radius 10…70 mm (${tg.circles.map((c) => c.r).join()})`);
check(tg.circles.every((c) => Object.keys(c).join() === "r"), "c.7 the circles carry no measure (25/11)");
// drawn: two axes and seven circles, no text
const ops: string[] = [];
const ctx = new Proxy({}, { get: (_o, k) => (typeof k === "string" && ["stroke", "arc", "fillText", "strokeText"].includes(k) ? () => ops.push(k) : () => {}), set: () => true }) as unknown as CanvasRenderingContext2D;
drawTarget(ctx, { scale: 4, ox: 0, oy: 0, width: 400, height: 400 }, hoop, 10);
check(ops.filter((o) => o === "arc").length === 7 && ops.filter((o) => o === "stroke").length === 8, `c.7 drawn: the axes and 7 circles (${ops.join(",")})`);
check(!ops.includes("fillText") && !ops.includes("strokeText"), "c.7 no measures written on the canvas");
check(targetGrid({ width: 130, height: 180 }, 25).circles.at(-1)!.r === 100, "the circles reach the hoop's farthest corner (130 × 180, every 25 → 100)");
check(targetGrid(hoop, 0).circles.length === 0, "a spacing of 0 draws no circles");

// c.8 through the bar button, with the module installed
setLanguage("en");
const memFiles = new Map<string, string>();
const prefs = await openPrefs({ read: async (n) => memFiles.get(n) ?? null, write: async (n, x) => void memFiles.set(n, x), rename: async (a, b) => void (memFiles.set(b, memFiles.get(a)!), memFiles.delete(a)) });
const aids = createViewAids(prefs);
const off = installViewAids(aids);
const before = useStore.getState();
const docBefore = before.doc;
const pastBefore = before.past.length;
check(aids.gridStep() === 10, "the grid step starts at 10 mm");
const stepBtn = toolbarButtons().find((b) => b.id === "c.gridStep")!;
check(!!stepBtn && t(stepBtn.label).includes("10"), `a bar button shows the step (${stepBtn && t(stepBtn.label)})`);
// from 10 the button goes round 1, 2, 5, 10: one press to 1, one more to 2
stepBtn.run();
stepBtn.run();
await aids.settled();
check(aids.gridStep() === 2, `c.8 the step is now 2 mm (${aids.gridStep()})`);
check(useStore.getState().gridStep === 2, "c.8 Filum's grid draws its lines every 2 mm (its gridStep)");
check(useStore.getState().doc === docBefore, "c.8 the document does not change");
check(useStore.getState().past.length === pastBefore, "c.8 no undo step");
check(JSON.parse(memFiles.get("nova-prefs.json")!).values["grid.step"] === 2, "grid.step kept in the app settings");
off();
check(!toolbarButtons().some((b) => b.module === "c"), "uninstalling removes the bar buttons");
done("module c, grids");
})();
