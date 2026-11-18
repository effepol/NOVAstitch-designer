// Module c, grids: c.7 (target grid on a 100 × 100 hoop, every 10 mm) and c.8
// (the grid step changed from 10 to 2 mm from the bar: lines every 2 mm, the
// document does not change, no undo step).

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { openPrefs } from "../core/prefs";
import { toolbarButtons } from "../core/registry";
import { setLanguage, t } from "../core/i18n";
import { gridLines, targetGrid } from "./grids";
import { createViewAids } from "./settings";
import { installViewAids } from "./install";

(async () => {

const hoop = { name: "100", width: 100, height: 100 };

// c.7
const tg = targetGrid(hoop, 10);
check(tg.center[0] === 50 && tg.center[1] === 50, "c.7 axes X and Y through the centre (50, 50)");
check(tg.circles.map((c) => c.r).join() === "10,20,30,40,50,60,70", `c.7 circles of radius 10…70 mm (${tg.circles.map((c) => c.r).join()})`);
check(tg.circles.every((c) => c.label === String(c.r)), "c.7 each circle has its measure");
check(targetGrid({ width: 130, height: 180 }, 25).circles.at(-1)!.r === 100, "the circles reach the hoop's farthest corner (130 × 180, every 25 → 100)");
check(targetGrid(hoop, 0).circles.length === 0, "a spacing of 0 draws no circles");

// grid lines anchored to the hoop's centre
const g10 = gridLines(hoop, 10, { x0: 0, y0: 0, x1: 100, y1: 100 });
check(g10.xs.join() === "0,10,20,30,40,50,60,70,80,90,100", "lines every 10 mm, through the centre");
const odd = gridLines({ width: 25, height: 25 }, 10, { x0: 0, y0: 0, x1: 25, y1: 25 });
check(odd.xs.join() === "2.5,12.5,22.5", "anchored to the hoop's centre, not its corner");

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
const g2 = gridLines(hoop, aids.gridStep(), { x0: 0, y0: 0, x1: 10, y1: 10 });
check(g2.xs.join() === "0,2,4,6,8,10", "c.8 lines every 2 mm");
check(useStore.getState().gridStep === 2, "Filum's grid follows the same step");
check(useStore.getState().doc === docBefore, "c.8 the document does not change");
check(useStore.getState().past.length === pastBefore, "c.8 no undo step");
check(JSON.parse(memFiles.get("nova-prefs.json")!).values["grid.step"] === 2, "grid.step kept in the app settings");
off();
check(!toolbarButtons().some((b) => b.module === "c"), "uninstalling removes the bar buttons");
done("module c, grids");
})();
