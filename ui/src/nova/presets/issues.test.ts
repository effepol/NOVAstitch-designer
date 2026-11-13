// Contract tests e.7 and e.11–e.15 (module e): the warnings from the Punch book.
// The stitch plans are built by hand (the engine does not run in Node): only
// what each warning reads from the plan is in them.

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { runCommand } from "../core/commands";
import { setLanguage, t } from "../core/i18n";
import { computeIssues } from "../../lib/issues";
import { defaultStitch, rectPath } from "../../lib/geometry";
import { FLAG, type DesignObject, type PlanData, type StitchDocument, type Vec2 } from "../../types";
import { parsePreset } from "./preset";
import { fabricIssues } from "./issues";
import { installPresetCommands } from "./commands";
import { setPresetList } from "./registry";
import "./texts";

const preset = (over: Record<string, unknown>) =>
  parsePreset(`${over.id}.json`, {
    schemaVersion: 1,
    rev: 1,
    name: { it: "Prova", en: "Test" },
    base: "cotton",
    elastic: false,
    overlap: { flat: 0.2, cap: 0.4 },
    limits: { minSpacing: 0.3 },
    info: { it: "Prova", en: "Test" },
    stabilizer: { type: "tear-away", weight: 50 },
    topping: "none",
    needlePoint: "normal",
    ...over,
  });
const stable = preset({ id: "stabile" });
const knit = preset({ id: "maglia", base: "knit", elastic: true, needlePoint: "ballpoint" });

const obj = (id: string, stitch: DesignObject["stitch"], paths = [rectPath(0, 0, 20, 20)]): DesignObject => ({ id, name: id, thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch });
const satin = (id: string, over: Record<string, unknown>) =>
  obj(id, { ...defaultStitch("satin"), ...over } as DesignObject["stitch"], [{ closed: false, nodes: [{ p: [0, 50] }, { p: [30, 50] }] }]);
const fill = (id: string, x: number, over: Record<string, unknown> = {}) => obj(id, { ...defaultStitch("fill"), ...over } as DesignObject["stitch"], [rectPath(x, 0, 20, 20)]);
const docOf = (objects: DesignObject[], weight = 40, presetId = "stabile"): StitchDocument => ({
  ...useStore.getState().doc,
  objects,
  options: { ...useStore.getState().doc.options!, threadWeight: weight as 40 },
  nova: { schemaVersion: 1, fabricPreset: { id: presetId, rev: 1 } },
});

/** A plan from each object's stitch points, in order (object index = position in the list). */
function planOf(perObject: Vec2[][]): PlanData {
  const pts = perObject.flatMap((ps, i) => ps.map((p, k) => ({ p, i, f: k === 0 && i > 0 ? FLAG.JUMP : 0 })));
  return {
    coords: new Float32Array(pts.flatMap((x) => x.p)),
    flags: new Uint8Array(pts.map((x) => x.f)),
    objects: new Uint32Array(pts.map((x) => x.i)),
    threads: [],
    stats: { stitches: pts.length } as PlanData["stats"],
  };
}
/** Back-and-forth rows filling [x0, x1] × [y0, y1], rows along x, moving along y from y0 to y1 (or back). */
function rows(x0: number, x1: number, y0: number, y1: number, spacing: number): Vec2[] {
  const out: Vec2[] = [];
  const n = Math.round(Math.abs(y1 - y0) / spacing);
  for (let k = 0; k <= n; k++) {
    const y = y0 + ((y1 - y0) * k) / n;
    const xs = Array.from({ length: Math.round((x1 - x0) / 2) + 1 }, (_, j) => x0 + j * 2);
    for (const x of k % 2 ? xs.reverse() : xs) out.push([x, y]);
  }
  return out;
}
const ofKind = <T extends { id: string }>(list: T[], kind: string) => list.filter((i) => i.id.startsWith(`e.${kind}:`));

setPresetList([stable, knit]);
const offCmds = installPresetCommands(() => null);

// ---- e.7: satin 12 mm wide → «satin troppo largo» (Filum's own warning; module e does not repeat it)
{
  const d = docOf([satin("s12", { width: 12 })]);
  const filum = computeIssues(d, null).filter((i) => i.objId === "s12" && /too wide/i.test(i.title));
  check(filum.length === 1, `e.7 a 12 mm satin has the warning «satin too wide» (${computeIssues(d, null).map((i) => i.title).join(", ")})`);
  check(!fabricIssues(d, null, stable).some((i) => /wide/i.test(i.id)), "e.7 module e does not add a second one");
}

// ---- e.11: satin with 0.15 mm between the stitches, No. 40 thread → «punti troppo fitti per filo e tessuto» (threshold from the preset)
{
  const d = docOf([satin("dense", { spacing: 0.15 }), satin("ok", { spacing: 0.4 })]);
  const found = ofKind(fabricIssues(d, null, stable), "dense");
  check(found.length === 1 && found[0].objId === "dense", `e.11 one warning, on the 0.15 mm satin (${found.map((i) => i.objId).join(", ")})`);
  setLanguage("it");
  check(found.length === 1 && fabricIssues(d, null, stable).find((i) => i.objId === "dense")!.title === t("e.issue.dense.title") && /troppo fitti/.test(t("e.issue.dense.title")), `e.11 «${t("e.issue.dense.title")}»`);
  setLanguage("en");
  check(/too dense|too close/i.test(t("e.issue.dense.title")), `e.11 English: «${t("e.issue.dense.title")}»`);
  // the threshold follows the thread: 0.25 mm is too dense for No. 40 (0.3 mm), fine for No. 60 (0.3 × width 60 / width 40 ≈ 0.24 mm)
  check(ofKind(fabricIssues(docOf([satin("x", { spacing: 0.25 })], 40), null, stable), "dense").length === 1, "e.11 0.25 mm with No. 40: too dense");
  check(ofKind(fabricIssues(docOf([satin("x", { spacing: 0.25 })], 60), null, stable), "dense").length === 0, "e.11 0.25 mm with No. 60: fine (the threshold scales with the thread)");
  check(ofKind(fabricIssues(docOf([satin("x", { spacing: 0.15 })]), null, null), "dense").length === 0, "e.11 no preset, no threshold: no warning");
  // fix: the spacing goes to the threshold, one undo step
  useStore.getState().setDoc(d, { history: false });
  const issue = found[0];
  runCommand("e.issue.fix", { issueId: issue.id });
  const s = useStore.getState().doc.objects[0].stitch as { spacing: number };
  check(s.spacing === 0.3 && !useStore.getState().doc.objects[0].nova?.edited?.length, `e.11 the fix sets the threshold (${s.spacing} mm), nothing in nova.edited`);
}

// ---- e.12: knit; two adjacent tatami whose rows sew towards each other → a warning on both
{
  const a = fill("A", 0);
  const b = fill("B", 20);
  const towards = planOf([rows(0, 20, 0, 20, 0.5).map(([x, y]) => [y, x] as Vec2), rows(20, 40, 0, 20, 0.5).map(([x, y]) => [60 - y - 20, x] as Vec2)]);
  const found = ofKind(fabricIssues(docOf([a, b], 40, "maglia"), towards, knit), "facing");
  check(found.length === 2 && found.some((i) => i.objId === "A") && found.some((i) => i.objId === "B"), `e.12 rows sewing towards each other on knit: a warning on both (${found.map((i) => i.objId).join(", ")})`);
  const same = planOf([rows(0, 20, 0, 20, 0.5).map(([x, y]) => [y, x] as Vec2), rows(0, 20, 0, 20, 0.5).map(([x, y]) => [y + 20, x] as Vec2)]);
  check(ofKind(fabricIssues(docOf([a, b], 40, "maglia"), same, knit), "facing").length === 0, "e.12 both sewing the same way: no warning");
  check(ofKind(fabricIssues(docOf([a, b]), towards, stable), "facing").length === 0, "e.12 on a stable fabric: no warning");
  const apart = fill("C", 40);
  check(ofKind(fabricIssues(docOf([a, apart], 40, "maglia"), planOf([rows(0, 20, 0, 20, 0.5).map(([x, y]) => [y, x] as Vec2), rows(40, 60, 0, 20, 0.5).map(([x, y]) => [60 - y, x] as Vec2)]), knit), "facing").length === 0, "e.12 not adjacent: no warning");
}

// ---- e.13: satin with zig-zag underlay and no contour → a warning
{
  const d = docOf([satin("z", { zigzagUnderlay: true, contourUnderlay: false }), satin("zc", { zigzagUnderlay: true, contourUnderlay: true })]);
  const found = ofKind(fabricIssues(d, null, stable), "zigzagOnly");
  check(found.length === 1 && found[0].objId === "z", `e.13 one warning, on the satin without contour (${found.map((i) => i.objId).join(", ")})`);
  check(ofKind(fabricIssues(docOf([satin("a", { zigzagUnderlay: true, underlayAuto: true })]), null, stable), "zigzagOnly").length === 0, "e.13 automatic underlay (the engine chooses): no warning");
  useStore.getState().setDoc(d, { history: false });
  const past = useStore.getState().past.length;
  runCommand("e.issue.fix", { issueId: found[0].id });
  const s = useStore.getState().doc.objects[0].stitch as { contourUnderlay: boolean };
  check(s.contourUnderlay === true && useStore.getState().past.length === past + 1, "e.13 the fix adds the contour underlay, one undo step");
}

// ---- e.14: knit; shape A, shape B, then the contour of A → «the contour of A goes right after A»
{
  const a = fill("A", 0);
  const b = fill("B", 40);
  const contour = obj("cA", { ...defaultStitch("running") } as DesignObject["stitch"], [rectPath(0, 0, 20, 20)]);
  const found = ofKind(fabricIssues(docOf([a, b, contour], 40, "maglia"), null, knit), "contourOrder");
  check(found.length === 1 && found[0].objId === "cA", `e.14 a warning on the contour of A (${found.map((i) => i.objId).join(", ")})`);
  setLanguage("it");
  check(!!found[0] && fabricIssues(docOf([a, b, contour], 40, "maglia"), null, knit).find((i) => i.objId === "cA")!.detail.includes("A"), "e.14 the warning names A");
  setLanguage("en");
  check(ofKind(fabricIssues(docOf([a, contour, b], 40, "maglia"), null, knit), "contourOrder").length === 0, "e.14 contour right after A: no warning");
  check(ofKind(fabricIssues(docOf([a, b, contour]), null, stable), "contourOrder").length === 0, "e.14 on a stable fabric: no warning");
  const other = obj("line", { ...defaultStitch("running") } as DesignObject["stitch"], [{ closed: false, nodes: [{ p: [0, 30] }, { p: [20, 30] }] }]);
  check(ofKind(fabricIssues(docOf([a, b, other], 40, "maglia"), null, knit), "contourOrder").length === 0, "e.14 a line that is not A's contour: no warning");
}

// ---- e.15: curved fill in a shape narrowing to 2 mm: rows below the set distance → a warning with the place
{
  const curved = obj("c", { ...defaultStitch("fill"), method: "curved", rowSpacing: 0.4, curve: 1 } as DesignObject["stitch"], [rectPath(0, 0, 40, 4)]);
  // 11 rows, 0.4 mm apart at x = 0 … 4 mm wide; the shape narrows to 2 mm at x = 30 (rows 0.2 mm apart there)
  const narrowing: Vec2[] = [];
  const width = (x: number) => (x <= 30 ? 4 - (2 * x) / 30 : 2 + (2 * (x - 30)) / 10);
  for (let k = 0; k <= 10; k++) {
    const xs = Array.from({ length: 41 }, (_, j) => j);
    for (const x of k % 2 ? xs.reverse() : xs) narrowing.push([x, (k / 10) * width(x)]);
  }
  const found = ofKind(fabricIssues(docOf([curved]), planOf([narrowing]), stable), "narrowRows");
  check(found.length === 1 && Math.abs(found[0].at[0] - 30) <= 1.5, `e.15 a warning with the place (at x ≈ 30: ${found[0]?.at.map((v) => v.toFixed(1)).join(", ")})`);
  const even: Vec2[] = [];
  for (let k = 0; k <= 10; k++) {
    const xs = Array.from({ length: 41 }, (_, j) => j);
    for (const x of k % 2 ? xs.reverse() : xs) even.push([x, k * 0.4]);
  }
  check(ofKind(fabricIssues(docOf([curved]), planOf([even]), stable), "narrowRows").length === 0, "e.15 rows at the set distance everywhere: no warning");
  check(ofKind(fabricIssues(docOf([curved]), null, stable), "narrowRows").length === 0, "e.15 no plan yet: no warning");
}

offCmds();
done("fabric warnings");
