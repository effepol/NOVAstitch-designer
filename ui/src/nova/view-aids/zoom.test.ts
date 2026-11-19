// Module c, zoom and screen calibration: c.4 (a ruler of 500 px measured
// 132 mm), c.5 (no calibration: 96/25.4 and «not calibrated»), c.6 (the buttons).
// Through module 0's hooks: the 1× scale (oneToOneScale) and the bar.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { on } from "../core/events";
import { openPrefs, type PrefsStore } from "../core/prefs";
import { setLanguage, t } from "../core/i18n";
import { oneToOneScale, toolbarButtons } from "../core/registry";
import { DEFAULT_PX_PER_MM, ZOOM_STEPS, screenScale, zoomStatus } from "./zoom";
import { calibrateScreen, pxPerMmFrom } from "./calibration";
import { createViewAids } from "./settings";
import { installViewAids } from "./install";
import "./texts";

const memStore = (): PrefsStore & { files: Map<string, string> } => {
  const files = new Map<string, string>();
  return {
    files,
    read: async (n) => files.get(n) ?? null,
    write: async (n, x) => void files.set(n, x),
    rename: async (a, b) => {
      files.set(b, files.get(a)!);
      files.delete(a);
    },
  };
};

(async () => {
  // c.4
  const px = pxPerMmFrom(500, 132);
  check(px.toFixed(3) === "3.788", `c.4 500 px measured 132 mm: pxPerMm = 3,788 (${px})`);
  check((screenScale(1, px) * 100).toFixed(1) === "378.8", "c.4 at 1× a 100 mm hoop takes 378,8 px");
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
  const aids = createViewAids(await openPrefs(store));
  const off = installViewAids(aids);
  const heard: number[] = [];
  const stop = on("screen.calibrated", (p) => heard.push(p.pxPerMm));
  const note = () => toolbarButtons().find((b) => b.id === "c.uncalibrated");

  // c.5
  setLanguage("it");
  check(aids.pxPerMm() === DEFAULT_PX_PER_MM && DEFAULT_PX_PER_MM === 96 / 25.4, "c.5 without calibration module c says 96/25,4 px/mm");
  check(Math.abs(oneToOneScale() - 96 / 25.4) < 1e-12, "c.5 … and the canvas's 1× is 96/25,4");
  check(!aids.calibrated() && zoomStatus(aids) === "non calibrato", `c.5 «non calibrato» (${zoomStatus(aids)})`);
  check(!!note() && t(note()!.label) === "non calibrato" && note()!.anchor === "c.uncalibrated", "c.5 the bar shows «non calibrato» (anchor c.uncalibrated)");
  setLanguage("en");
  check(t(note()!.label) === "not calibrated", "c.5 … and «not calibrated» in English");

  await calibrateScreen(aids, 500, 132);
  check(aids.calibrated() && aids.pxPerMm() === px, "after the calibration module c uses the measured px/mm");
  check(oneToOneScale() === px && (oneToOneScale() * 100).toFixed(1) === "378.8", "c.4 the canvas's 1× is the calibration: a 100 mm hoop takes 378,8 px");
  check(heard.length === 1 && heard[0] === px, "screen.calibrated({pxPerMm}) is sent once");
  check(JSON.parse(store.files.get("nova-prefs.json")!).values["screen.pxPerMm"] === px, "kept in the app settings (screen.pxPerMm)");
  check(zoomStatus(aids) === "" && !note(), "calibrated: «not calibrated» leaves the bar");
  off();
  check(Math.abs(oneToOneScale() - 96 / 25.4) < 1e-12, "module c removed: 1× back to 96/25,4");
  const again = createViewAids(await openPrefs(store));
  check(again.pxPerMm() === px, "read again at the next start");
  stop();

  // c.6: the bar (module 0's hook in BottomBar.tsx): «fit», then exactly 0.5×, 1×, 2×, 4×, 6×
  const bar = readFileSync(path.resolve(process.cwd(), "src", "components", "BottomBar.tsx"), "utf8");
  const zooms = /const zooms = \[([^\]]*)\]/.exec(bar)?.[1].split(",").map((x) => Number(x.trim()));
  check(JSON.stringify(zooms) === JSON.stringify(ZOOM_STEPS.filter((z) => z !== "fit")), `c.6 the bar's zoom buttons are 0.5×, 1×, 2×, 4×, 6× (${zooms})`);
  const fitAt = bar.indexOf('fit("design")');
  check(fitAt > 0 && fitAt < bar.indexOf("zooms.map"), "c.6 «fit» comes before them");
  check(!zooms?.includes(3), "c.6 Filum's 3× is gone");
  done("module c, zoom and calibration");
})();
