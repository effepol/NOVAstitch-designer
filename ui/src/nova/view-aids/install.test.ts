// Module c in the app: texts in both languages, anchors listed, layers, buttons
// and menu items registered and removed, settings checked; nothing of Filum is touched.

import { check, done } from "../core/testkit";
import { canvasLayers, menuItems, toolbarButtons } from "../core/registry";
import { openPrefs } from "../core/prefs";
import { createViewAids } from "./settings";
import { installViewAids } from "./install";
import it from "./it.json";
import en from "./en.json";
import anchors from "./anchors.json";

(async () => {

const keys = (o: Record<string, string>) => Object.keys(o).sort().join();
check(keys(it) === keys(en) && Object.keys(it).every((k) => k.startsWith("c.")), "it.json and en.json have the same c.* keys");
check(Object.keys(anchors).length > 0 && Object.keys(anchors).every((k) => k.startsWith("c.")), "anchors.json lists c.* anchors");

const files = new Map<string, string>();
const aids = createViewAids(await openPrefs({ read: async (n) => files.get(n) ?? null, write: async (n, x) => void files.set(n, x), rename: async (a, b) => void (files.set(b, files.get(a)!), files.delete(a)) }));
const off = installViewAids(aids);
check(canvasLayers().some((l) => l.id === "c.target" && l.z === "under"), "the target grid is a layer under the design");
check(canvasLayers().some((l) => l.id === "c.cross" && (l.z ?? "over") === "over"), "the cross is a layer over the design");
check(toolbarButtons().some((b) => b.id === "c.target") && toolbarButtons().some((b) => b.id === "c.cursorMode"), "bar buttons for the target grid and the cross");
check(menuItems().some((m) => m.id === "c.calibrate" && m.menu === "View"), "View → Calibrate the screen");
for (const k of ["c.mode.normal", "c.mode.crossCanvas", "c.mode.crossWindow"]) check(menuItems().some((m) => m.id === k), `${k} in the View menu`);

// settings: wrong values are refused, the old value stays
let refused = 0;
for (const [k, v] of [["grid.step", 0], ["grid.step", -1], ["target.spacing", NaN], ["cursor.mode", "diagonal"], ["screen.pxPerMm", 0]] as const) {
  try {
    await aids.set(k, v as never);
  } catch {
    refused++;
  }
}
check(refused === 5 && aids.gridStep() === 10 && aids.cursorMode() === "normal", "wrong settings are refused");
await aids.set("cursor.mode", "crossWindow");
check(aids.cursorMode() === "crossWindow", "cursor.mode = crossWindow");
// a damaged value in the file falls back to the default
files.set("nova-prefs.json", JSON.stringify({ schemaVersion: 1, values: { "grid.step": "x", "cursor.mode": 3, "screen.pxPerMm": -2 } }));
const damaged = createViewAids(await openPrefs({ read: async (n) => files.get(n) ?? null, write: async () => {}, rename: async () => {} }));
check(damaged.gridStep() === 10 && damaged.cursorMode() === "normal" && !damaged.calibrated(), "damaged settings: the defaults");
off();
check(!canvasLayers().some((l) => l.id.startsWith("c.")) && !menuItems().some((m) => m.module === "c"), "uninstalling removes layers and menu items");
done("module c in the app");
})();
