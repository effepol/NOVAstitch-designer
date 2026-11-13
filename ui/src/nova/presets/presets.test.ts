// Contract tests e.1–e.6 and e.8–e.10 (module e): fabric presets, their values
// in the objects, nova.edited, e.param.reset, one undo step.
// The presets here are test data (values chosen for the checks), not the shipped ones.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { useStore } from "../../store";
import { on } from "../core/events";
import { runCommand } from "../core/commands";
import { setModeSource } from "../core/mode";
import { defaultStitch, rectPath, setFabricDefaults } from "../../lib/geometry";
import type { DesignObject, FillParams, SatinParams, StitchDocument } from "../../types";
import { loadPresets, parsePreset, PresetError, type FabricPreset } from "./preset";
import { applyPreset, newObjectDefaults, presetValuesFor } from "./apply";
import { installPresetCommands } from "./commands";
import { setPresetList } from "./registry";

const base = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  id: "prova",
  rev: 1,
  name: { it: "Prova", en: "Test" },
  base: "cotton",
  elastic: false,
  overlap: { flat: 0.2, cap: 0.4 },
  limits: { minSpacing: 0.3 },
  info: { it: "Scheda di prova", en: "Test sheet" },
  stabilizer: { type: "tear-away", weight: 50 },
  topping: "none",
  needlePoint: "normal",
  ...over,
});
const file = (o: Record<string, unknown>) => JSON.stringify(o);

// A: tatami underlay across the rows; B: no underlay, other spacing
const A = parsePreset("a.json", base({ id: "a", name: { it: "A", en: "A" }, fill: { underlay: true, underlayAngle: 90, underlaySpacing: 0.8, pullComp: 0.3 }, satin: { spacing: 0.4, contourInset: 0.5 }, satinContourFrom: 2 }));
const B = parsePreset("b.json", base({ id: "b", rev: 3, name: { it: "B", en: "B" }, base: "knit", elastic: true, fill: { underlay: false, rowSpacing: 0.3, pullComp: 0.5 }, satin: { spacing: 0.45, contourInset: 0.5 }, satinContourFrom: 2 }));
setPresetList([A, B]);
const offCmds = installPresetCommands();

const st = () => useStore.getState();
const fillOf = (o: DesignObject) => o.stitch as { type: "fill" } & FillParams;
const satinOf = (o: DesignObject) => o.stitch as { type: "satin" } & SatinParams;
const sq = (id: string, x: number, y = 0, w = 20): DesignObject => ({ id, name: id, thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths: [rectPath(x, y, w, w)], stitch: defaultStitch("fill") });
const satinLine = (id: string, width: number): DesignObject => ({
  id,
  name: id,
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: false, nodes: [{ p: [0, 50] }, { p: [30, 50] }] }],
  stitch: { ...defaultStitch("satin"), width } as DesignObject["stitch"],
});
const load = (objects: DesignObject[], over: Partial<StitchDocument> = {}) => st().setDoc({ ...st().doc, ...over, objects, nova: { schemaVersion: 1, ...over.nova } }, { history: false });
// module 0's hook (not in main yet): new objects start from the preset, then the fabric calibration on top
setFabricDefaults(() => newObjectDefaults(st().doc));

// ---- e.8: no preset → Filum's defaults (0.25 mm between the tatami rows)
load([]);
check(fillOf({ stitch: defaultStitch("fill") } as DesignObject).rowSpacing === 0.25, "e.8 without a preset a new tatami has 0.25 mm between the rows (Filum)");

// ---- e.1: preset with the tatami underlay across the rows, then a tatami is drawn
setModeSource(() => "studio");
runCommand("e.preset.apply", { presetId: "a" });
check(st().doc.nova?.fabricPreset?.id === "a" && st().doc.nova?.fabricPreset?.rev === 1 && st().doc.fabric === "cotton", "e.1 the preset is in force: nova.fabricPreset = {id: a, rev: 1}, doc.fabric = its base");
const drawn = sq("t0", 0);
const f0 = fillOf(drawn);
check(f0.underlay === true && f0.underlayAngle === 90 && f0.underlaySpacing === 0.8, `e.1 the new tatami has the underlay across the rows with the preset's values (${f0.underlay}, ${f0.underlayAngle}°, ${f0.underlaySpacing} mm)`);
check(f0.expand === 0.2 && f0.pullComp === 0.3, `e.1/e.10 and the preset's overlap and compensation (expand ${f0.expand}, pullComp ${f0.pullComp})`);

// ---- e.2: in Studio the user takes the underlay off that tatami
const others = [1, 2, 3, 4, 5].map((i) => sq(`t${i}`, 25 * i));
load([drawn, ...others], { fabric: "cotton", nova: { schemaVersion: 1, fabricPreset: { id: "a", rev: 1 } } });
st().updateStitch("t0", { underlay: false });
const t0 = () => st().doc.objects.find((o) => o.id === "t0")!;
check(fillOf(t0()).underlay === false && (t0().nova?.edited ?? []).includes("stitch.underlay"), `e.2 underlay off; nova.edited has stitch.underlay (${JSON.stringify(t0().nova?.edited)})`);

// ---- e.3: another preset; the 5 untouched tatami take the new values, the edited one keeps no underlay; one undo step
const events: unknown[] = [];
const offEv = on("preset.applied", (p) => events.push(p));
const past = st().past.length;
runCommand("e.preset.apply", { presetId: "b" });
const five = st().doc.objects.filter((o) => o.id !== "t0");
check(five.every((o) => fillOf(o).underlay === false && fillOf(o).rowSpacing === 0.3 && fillOf(o).pullComp === 0.5), "e.3 the 5 untouched tatami take preset B's values");
check(five.every((o) => fillOf(o).underlayAngle === 90 && fillOf(o).underlaySpacing === 0.75), "e.3 a value A set and B does not set goes back to Filum's (underlay spacing 0.75)");
check(five.every((o) => fillOf(o).expand === 0.2), "e.3 overlap 0.2 mm on a flat hoop");
check(fillOf(t0()).underlay === false && fillOf(t0()).rowSpacing === 0.3, "e.3 the edited tatami keeps its underlay off (and takes the other values)");
check(five.every((o) => !o.nova?.edited?.length), "e.3 applying a preset records nothing in nova.edited (system command)");
check(st().past.length === past + 1, `e.3 one undo step (${st().past.length - past})`);
check(st().doc.fabric === "knit" && st().doc.nova?.fabricPreset?.id === "b" && st().doc.nova?.fabricPreset?.rev === 3, "e.3 doc.fabric and nova.fabricPreset follow the preset");
const ev = events[0] as { presetId: string; changedObjects: string[]; skippedParams: { id: string; params: string[] }[] } | undefined;
check(
  !!ev && ev.presetId === "b" && ev.changedObjects.length === 6 && ev.skippedParams.length === 1 && ev.skippedParams[0].id === "t0" && ev.skippedParams[0].params.join() === "stitch.underlay",
  `e.3 preset.applied {presetId, changedObjects, skippedParams} (${JSON.stringify(ev)})`,
);
st().undo();
check(st().doc.nova?.fabricPreset?.id === "a" && fillOf(st().doc.objects[1]).underlay === true, "e.3 one undo brings everything back to preset A");
st().redo();

// ---- e.4: e.param.reset on that tatami's underlay
runCommand("e.param.reset", { id: "t0", param: "stitch.underlay" });
check(fillOf(t0()).underlay === false && !(t0().nova?.edited ?? []).includes("stitch.underlay"), "e.4 underlay of the preset in force (B: off); the parameter is out of nova.edited");
runCommand("e.preset.apply", { presetId: "a" });
check(fillOf(t0()).underlay === true, "e.4 …and from now on it follows the presets again (A: on)");
offEv();

// ---- e.5: a preset file without the English name
const good = file(base({ id: "buono" }));
const noEn = file(base({ id: "senza-inglese", name: { it: "Senza inglese" } }));
const r = loadPresets({ "buono.json": good, "senza-inglese.json": noEn, "rotto.json": "{" });
const err = r.errors.find((e) => e.file === "senza-inglese.json");
check(r.presets.length === 1 && r.presets[0].id === "buono", "e.5 the other presets are loaded");
check(!!err && err.field === "name.en" && err.message.includes("senza-inglese.json") && err.message.includes("name.en"), `e.5 refused with an error naming file and field (${err?.message})`);
check(r.errors.some((e) => e.file === "rotto.json"), "e.5 a damaged file is refused too, the others still load");
let threw = "";
try {
  parsePreset("x.json", base({ id: "x", satin: { spacin: 0.4 } }));
} catch (e) {
  threw = e instanceof PresetError ? e.field : "";
}
check(threw === "satin.spacin", `a misspelt parameter is refused, not ignored (${threw})`);
try {
  threw = "";
  parsePreset("y.json", base({ id: "y", overlap: { flat: 0.2000001, cap: 0.4 } }));
} catch (e) {
  threw = e instanceof PresetError ? e.field : "";
}
check(threw === "overlap.flat", "numbers with more than 6 decimals are refused");

// ---- e.6: every shipped preset, applied to new objects, gives exactly its values
const dir = path.resolve(process.cwd(), "src/nova/presets/fabric");
const shipped = loadPresets(Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(path.join(dir, f), "utf8")])));
check(shipped.errors.length === 0, `e.6 every shipped preset is valid (${shipped.errors.map((e) => e.message).join("; ") || `${shipped.presets.length} presets`})`);
for (const p of shipped.presets) {
  setPresetList([A, B, ...shipped.presets]);
  load([]);
  runCommand("e.preset.apply", { presetId: p.id });
  // running stitch: module 0's hook will give new lines the preset's values as it does for satin and fill
  const kinds = [
    ["satin", p.satin, defaultStitch("satin")],
    ["fill", p.fill, defaultStitch("fill")],
    ["running", p.running, { ...defaultStitch("running"), ...newObjectDefaults(st().doc).running }],
  ] as const;
  for (const [kind, want, got] of kinds) {
    const g = got as unknown as Record<string, unknown>;
    const wrong = Object.entries(want ?? {}).filter(([k, v]) => !(kind === "satin" && k === "contourUnderlay") && g[k] !== v);
    check(wrong.length === 0, `e.6 ${p.id}: a new ${kind} has the file's values (${wrong.map(([k, v]) => `${k}: ${g[k]} ≠ ${v}`).join(", ") || "all"})`);
  }
  check(fillOf({ stitch: defaultStitch("fill") } as DesignObject).expand === p.overlap.flat, `e.6 ${p.id}: overlap ${p.overlap.flat} mm`);
}
setPresetList([A, B]);

// ---- e.9: satin 3 mm wide with the preset applied → contour underlay 0.5 mm from the edge
load([satinLine("s3", 3), satinLine("s1", 1.5)]);
runCommand("e.preset.apply", { presetId: "a" });
const s3 = satinOf(st().doc.objects[0]);
const s1 = satinOf(st().doc.objects[1]);
check(s3.contourUnderlay === true && s3.contourInset === 0.5, `e.9 3 mm satin: contour underlay 0.5 mm from the edge (${s3.contourUnderlay}, ${s3.contourInset})`);
check(s1.contourUnderlay === false, "e.9 a 1.5 mm satin gets no contour underlay (from 2 mm up)");

// ---- e.10: two touching 20×20 tatami; stable fabric → expand 0.2 (20.4 × 20.4); cap hoop or stretchy → 0.4 (20.8 × 20.8)
const grown = (o: DesignObject) => 20 + 2 * (fillOf(o).expand ?? 0);
load([sq("p", 0), sq("q", 20)]);
runCommand("e.preset.apply", { presetId: "a" });
check(st().doc.objects.every((o) => fillOf(o).expand === 0.2 && grown(o) === 20.4), "e.10 stable fabric: expand 0.2 mm on both, 20.4 × 20.4 mm each");
check(st().doc.objects.every((o) => fillOf(o).pullComp === 0.3), "e.10 the preset's compensation is added on top (pullComp stays)");
load([sq("p", 0), sq("q", 20)], { nova: { schemaVersion: 1, hoopKind: "cap" } });
runCommand("e.preset.apply", { presetId: "a" });
check(st().doc.objects.every((o) => fillOf(o).expand === 0.4 && Math.abs(grown(o) - 20.8) < 1e-9), "e.10 cap frame: expand 0.4 mm, 20.8 × 20.8 mm");
const stretchy: FabricPreset = { ...B, id: "maglia-prova", overlap: { flat: 0.4, cap: 0.4 } };
check(presetValuesFor(stretchy, defaultStitch("fill"), "flat").expand === 0.4, "e.10 stretchy fabric: the preset's own overlap 0.4 mm");

// calibration on top of the preset in new objects (Architect, 13/11): the user's measurement wins
setFabricDefaults(() => newObjectDefaults(st().doc, { fill: { pullComp: 0.45 } }));
check(fillOf({ stitch: defaultStitch("fill") } as DesignObject).pullComp === 0.45, "calibration: the measured pull compensation wins over the preset's");
check(fillOf({ stitch: defaultStitch("fill") } as DesignObject).underlayAngle === 90, "calibration: …the preset's other values stay");

// a preset applied to a doc with nothing to change leaves no undo step
load([]);
const p0 = st().past.length;
runCommand("e.preset.apply", { presetId: st().doc.nova?.fabricPreset?.id ?? "a" });
runCommand("e.preset.apply", { presetId: "a" });
check(st().past.length - p0 <= 1, "applying the same preset twice: at most one step");
check(applyPreset(st().doc, A, A).doc === st().doc, "applying the preset in force to an unchanged design changes nothing");

setFabricDefaults(() => ({}));
setModeSource(null);
offCmds();
done("fabric preset");
