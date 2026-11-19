// Module e in the app, through module 0's hooks (#54): Filum's fabric pickers
// (store.setFabric → chooseFabric) apply the fabric's preset as e.preset.apply,
// new objects start from the preset with the calibration on top
// (composedFabricDefaults), and the warnings show in Filum's Issues list
// (registerIssueCheck → computeIssues).

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { emptyDoc, useStore } from "../../store";
import { composedFabricDefaults } from "../core/objectDefaults";
import { setModeSource } from "../core/mode";
import { computeIssues } from "../../lib/issues";
import { defaultFill, defaultRunning, defaultSatin, defaultStitch, setFabricDefaults } from "../../lib/geometry";
import type { DesignObject, StitchDocument } from "../../types";
import { install, refusedPresets } from "./install";
import { slotEntries } from "../core/slots";

const st = () => useStore.getState();
const reset = (doc: StitchDocument) => useStore.setState({ doc, past: [], future: [], selection: [], plan: null });
const dir = path.resolve(process.cwd(), "src/nova/presets/fabric");
const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [`./fabric/${f}`, readFileSync(path.join(dir, f), "utf8")]));

// as main.tsx does: module 0's composed function, the calibration on top
let calibration: { satin?: Record<string, number>; fill?: Record<string, number> } = {};
setFabricDefaults(composedFabricDefaults(() => calibration));
setModeSource(() => "studio");

const err = console.error;
const logged: string[] = [];
console.error = (...a: unknown[]) => void logged.push(a.join(" "));
const uninstall = install({ ...files, "./fabric/rotto.json": "{" });
console.error = err;
check(refusedPresets().length === 1 && refusedPresets()[0].file === "rotto.json" && logged.some((l) => l.includes("rotto.json")), "e.5 at start: the damaged file is refused and named");

// ---- the fabric picker (Material panel, title bar: store.setFabric) applies the fabric's preset, one undo step
const tatami = (id: string, x: number): DesignObject => ({
  id,
  name: id,
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: true, nodes: [[x, 0], [x + 20, 0], [x + 20, 20], [x, 20]].map((p) => ({ p: p as [number, number] })) }],
  stitch: defaultStitch("fill"),
});
reset({ ...emptyDoc(), fabric: "cotton", objects: [tatami("a", 0), tatami("b", 20)] });
st().setFabric("knit");
const fill = (o: DesignObject) => o.stitch as unknown as Record<string, unknown>;
check(st().doc.fabric === "knit" && st().doc.nova?.fabricPreset?.id === "maglia", `picking Knit puts the preset «maglia» in force (${JSON.stringify(st().doc.nova?.fabricPreset)})`);
check(st().doc.objects.every((o) => fill(o).pullComp === 1 && fill(o).expand === 0.4 && fill(o).underlay === true && fill(o).underlayAngle === 90), "its values are in the objects (pull 1 mm, overlap 0.4 mm, underlay across the rows)");
check(st().past.length === 1, `one undo step (${st().past.length})`);
st().undo();
check(st().doc.fabric === "cotton" && !st().doc.nova?.fabricPreset && fill(st().doc.objects[0]).pullComp === 0, "one undo brings the fabric and the values back");
st().redo();
st().setFabric("cotton");
check(st().doc.nova?.fabricPreset?.id === "cotone" && st().doc.objects.every((o) => fill(o).pullComp === 0 && fill(o).expand === 0.2), "picking Cotton: preset «cotone», pull 0, overlap 0.2 mm");

// ---- new objects: the preset in force, then the calibration on top
st().setFabric("knit");
check(defaultFill().pullComp === 1 && defaultFill().expand === 0.4 && defaultSatin().contourInset === 0.5 && defaultSatin().pullComp === 1, "e.1 a new tatami / satin starts from the preset in force");
check(defaultRunning().length === 2.5, "running stitch: the preset sets nothing, Filum's value");
calibration = { fill: { pullComp: 0.45 } };
check(defaultFill().pullComp === 0.45 && defaultFill().underlayAngle === 90, "the fabric calibration's pull compensation wins, the preset's other values stay");
// the calibration replaces the pull compensation; its expand adds to the preset's overlap (Architect, 19/11)
st().setFabric("cotton");
calibration = { fill: { expand: 0.1 } };
check(defaultFill().expand === 0.3, `calibrated fabric, expand 0.1 mm, preset «cotone» 0.2 mm → 0.3 mm (${defaultFill().expand})`);
calibration = { fill: { expand: -0.1, pullComp: 0.45 } };
check(defaultFill().expand === 0.1 && defaultFill().pullComp === 0.45, `… a negative expand subtracts, the compensation is replaced (${defaultFill().expand}, ${defaultFill().pullComp})`);
calibration = {};
reset({ ...emptyDoc(), fabric: "cotton" });
check(defaultFill().rowSpacing === 0.25 && defaultFill().pullComp === 0, "e.8 no preset in force: Filum's defaults (0.25 mm between the rows)");

// ---- warnings in Filum's Issues list
const satin = (spacing: number): DesignObject => ({
  id: "s",
  name: "s",
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: false, nodes: [{ p: [10, 50] }, { p: [40, 50] }] }],
  stitch: { ...defaultStitch("satin"), spacing, zigzagUnderlay: true, contourUnderlay: false } as DesignObject["stitch"],
});
reset({ ...emptyDoc(), fabric: "cotton" });
st().setFabric("cotton");
// drawn after the preset is in force (applying it would add the contour underlay itself)
useStore.setState({ doc: { ...st().doc, objects: [satin(0.15)] } });
const ids = computeIssues(st().doc, null).map((i) => i.id);
check(ids.includes("e.dense:s") && ids.includes("e.zigzagOnly:s"), `e.11 / e.13 in the Issues list (${ids.join(", ")})`);

// ---- module 0's spaces: the preset card under the fabric picker, the summary in the export dialog
check(slotEntries("material").some((e) => e.id === "e.presetCard" && e.module === "e"), "the preset card is in the fabric panel's space");
check(slotEntries("export").some((e) => e.id === "e.exportSummary" && e.module === "e"), "the summary is in the export dialog's space");

// ---- uninstalled: Filum's own change again
uninstall();
reset({ ...emptyDoc(), fabric: "cotton" });
st().setFabric("knit");
check(st().doc.fabric === "knit" && !st().doc.nova?.fabricPreset, "uninstalled: Filum's own fabric change");
check(!computeIssues({ ...st().doc, objects: [satin(0.15)] }, null).some((i) => i.id.startsWith("e.")), "uninstalled: no module e warnings");
check(!slotEntries("material").length && !slotEntries("export").length, "uninstalled: the spaces are empty");

setFabricDefaults(() => ({}));
setModeSource(null);
done("module e in the app");
