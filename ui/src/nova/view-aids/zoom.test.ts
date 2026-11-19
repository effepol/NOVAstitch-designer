// Module c, zoom and screen calibration: c.4 (a ruler of 500 px measured
// 132 mm), c.5 (no calibration: 96/25.4 and «not calibrated»), c.6 (the buttons).

import { check, done } from "../core/testkit";
import { on } from "../core/events";
import { openPrefs, type PrefsStore } from "../core/prefs";
import { setLanguage } from "../core/i18n";
import { FILUM_PX_PER_MM } from "../core/bridge";
import { DEFAULT_PX_PER_MM, ZOOM_STEPS, filumFactor, screenScale, zoomLabel, zoomStatus, zoomStepAt } from "./zoom";
import { calibrateScreen, pxPerMmFrom } from "./calibration";
import { createViewAids } from "./settings";
import "./texts";

(async () => {

const memStore = (): PrefsStore & { files: Map<string, string> } => {
  const files = new Map<string, string>();
  return {
    files,
    read: async (n) => files.get(n) ?? null,
    write: async (n, t) => void files.set(n, t),
    rename: async (a, b) => {
      files.set(b, files.get(a)!);
      files.delete(a);
    },
  };
};

// c.4
const px = pxPerMmFrom(500, 132);
check(px.toFixed(3) === "3.788", `c.4 500 px measured 132 mm: pxPerMm = 3,788 (${px})`);
check(screenScale(1, px) * 100 === 100 * px && (screenScale(1, px) * 100).toFixed(1) === "378.8", "c.4 at 1× a 100 mm hoop takes 378,8 px");
check(screenScale(2, px) === 2 * px && screenScale(0.5, px) === px / 2, "k× = k · pxPerMm");
let bad = 0;
for (const [l, m] of [[0, 10], [500, 0], [500, -3], [NaN, 10], [500, Infinity]]) {
  try {
    pxPerMmFrom(l, m);
  } catch {
    bad++;
  }
}
check(bad === 5, "a ruler or a measure that is zero, negative or not a number is refused");

const store = memStore();
const prefs = await openPrefs(store);
const aids = createViewAids(prefs);
const heard: number[] = [];
const stop = on("screen.calibrated", (p) => heard.push(p.pxPerMm));

// c.5
setLanguage("it");
check(aids.pxPerMm() === DEFAULT_PX_PER_MM && DEFAULT_PX_PER_MM === 96 / 25.4, "c.5 without calibration 1× uses 96/25,4 px/mm");
check(!aids.calibrated() && zoomStatus(aids) === "non calibrato", `c.5 the bar says «non calibrato» (${zoomStatus(aids)})`);
setLanguage("en");
check(zoomStatus(aids) === "not calibrated", "c.5 … and «not calibrated» in English");

await calibrateScreen(aids, 500, 132);
check(aids.calibrated() && aids.pxPerMm() === px, "after the calibration 1× uses the measured px/mm");
check(heard.length === 1 && heard[0] === px, "screen.calibrated({pxPerMm}) is sent once");
check(JSON.parse(store.files.get("nova-prefs.json")!).values["screen.pxPerMm"] === px, "kept in the app settings (screen.pxPerMm)");
check(zoomStatus(aids) === "", "calibrated: nothing to say in the bar");
const again = createViewAids(await openPrefs(store));
check(again.pxPerMm() === px, "read again at the next start");
stop();

// c.6
check(ZOOM_STEPS.map(zoomLabel).join(" | ") === "Fit | 0.5× | 1× | 2× | 4× | 6×", `c.6 exactly fit, 0.5×, 1×, 2×, 4×, 6× (${ZOOM_STEPS.map(zoomLabel).join(" | ")})`);
setLanguage("it");
check(ZOOM_STEPS.map(zoomLabel).join(" | ") === "Adatta | 0,5× | 1× | 2× | 4× | 6×", `c.6 in Italian: adatta, 0,5×… (${ZOOM_STEPS.map(zoomLabel).join(" | ")})`);
setLanguage("en");
check(!ZOOM_STEPS.includes(3 as never), "c.6 Filum's 3× is gone");
// Filum's fit(k) zooms to k · 96/25.4: module c asks for the factor that gives k · pxPerMm
check(Math.abs(filumFactor(2, px) * FILUM_PX_PER_MM - 2 * px) < 1e-9, "the factor passed to Filum's zoom gives k · pxPerMm");
check(zoomStepAt(4 * px, px) === 4 && zoomStepAt(3 * px, px) === null, "the button lit is the one of the current scale");
done("module c, zoom and calibration");
})();
