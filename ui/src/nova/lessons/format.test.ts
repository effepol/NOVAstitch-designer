// Module g: the lesson format and its validator (contract «g — Apprentice Mode»).
//   g.5  a lesson with a condition of an unknown type is refused with a message; no crash
//   g.6  a lesson with an anchor nobody declares is refused
// Also: the public schema (lesson.schema.json) and the program accept and refuse the same files.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { loadLessons, parseLesson, type LessonFiles } from "./lesson";
import { declaredAnchors } from "./anchors";

const here = path.resolve(process.cwd(), "src/nova/lessons");
const schema = JSON.parse(readFileSync(path.join(here, "lesson.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "the lesson schema is JSON Schema 2020-12");

const anchors = new Set(["b.panel", "c.target"]);
const good = () => ({
  id: "prova",
  rev: 1,
  path: "vector",
  title: { it: "Prova", en: "Test" },
  modes: ["assisted", "studio"],
  steps: [
    {
      id: "satin",
      text: { it: "Disegna un satin largo 3–5 mm.", en: "Draw a satin 3–5 mm wide." },
      highlight: "b.panel",
      check: { all: [{ exists: { type: "satin", param: { width: { min: 3, max: 5 } }, count: { min: 1 } } }, { not: [{ selection: { count: 0 } }] }] },
      hint: { it: "La larghezza è nel pannello del punto.", en: "The width is in the stitch panel." },
      reset: "step",
    },
    {
      id: "vista",
      text: { it: "Guarda i punti.", en: "Look at the stitches." },
      highlight: { object: "o1" },
      waitFor: "view.changed",
      check: { any: [{ view: { mode: "stitch" } }, { view: { zoom: { min: 2 } } }, { plan: { stitches: { min: 10 }, trims: { max: 3 } } }] },
      hint: { it: "Passa alla vista punti.", en: "Switch to the stitch view." },
      reset: "start",
    },
  ],
});
type L = ReturnType<typeof good> & Record<string, unknown>;
const refusal = (l: unknown) => {
  const r = parseLesson(l, { anchors, folder: "prova" });
  return r.ok ? null : r.errors.join(" / ");
};
const both = (l: unknown) => ({ program: refusal(l) === null, schema: !!validate(l) });

{
  const r = parseLesson(good(), { anchors, folder: "prova" });
  check(r.ok && r.lesson.steps.length === 2, "a good lesson is accepted");
  check(validate(good()) === true, `a good lesson validates against the schema ${JSON.stringify(validate.errors ?? [])}`);
}

// g.5: an unknown condition type
{
  const l = good() as L;
  l.steps[0].check = { all: [{ exists: { type: "satin" } }, { colour: { is: "red" } }] } as never;
  let msg: string | null = null;
  let crashed = false;
  try {
    msg = refusal(l);
  } catch {
    crashed = true;
  }
  check(!crashed && !!msg && msg.includes("colour") && msg.includes("satin"), `g.5 unknown condition refused with a message naming it and the step: ${msg}`);
  check(!validate(l), "g.5 the schema refuses it too");
  // as text that is not JSON, and a lesson that is not an object: refused, no crash
  const bad = loadLessons({ prova: { "lesson.json": "{ not json" }, altra: { "lesson.json": "[1,2]" } }, anchors);
  check(bad.lessons.length === 0 && bad.errors.length === 2 && bad.errors.every((e) => e.message.length > 0), "g.5 damaged files are refused, each with a message");
}

// g.6: an anchor nobody declares
{
  const l = good() as L;
  l.steps[1].highlight = "x.nessuno" as never;
  const msg = refusal(l);
  check(!!msg && msg.includes("x.nessuno"), `g.6 undeclared anchor refused: ${msg}`);
}

// more mistakes: the program and the schema agree
const cases: [string, (l: L) => void][] = [
  ["unknown key on the lesson", (l) => (l.extra = 1)],
  ["unknown path", (l) => (l.path = "altro")],
  ["unknown mode", (l) => (l.modes = ["expert"])],
  ["no steps", (l) => (l.steps = [])],
  ["text without English", (l) => (l.steps[0].text = { it: "solo italiano" } as never)],
  ["hint missing", (l) => delete (l.steps[0] as Partial<L["steps"][0]>).hint],
  ["bad reset", (l) => (l.steps[0].reset = "never")],
  ["range without bounds", (l) => (l.steps[0].check = { exists: { type: "satin", param: { width: {} } } } as never)],
  ["range with a string", (l) => (l.steps[0].check = { exists: { type: "satin", param: { width: { min: "3" } } } } as never)],
  ["two kinds in one condition", (l) => (l.steps[0].check = { view: { mode: "stitch" }, selection: { count: 1 } } as never)],
  ["unknown plan measure", (l) => (l.steps[1].check = { plan: { colours: { min: 1 } } } as never)],
  ["unknown view mode", (l) => (l.steps[1].check = { view: { mode: "3d" } } as never)],
  ["empty all", (l) => (l.steps[0].check = { all: [] } as never)],
  ["code in a condition", (l) => (l.steps[0].check = "doc.objects.length > 0" as never)],
  ["bad event name", (l) => (l.steps[1].waitFor = "click")],
];
for (const [what, spoil] of cases) {
  const l = good() as L;
  spoil(l);
  const b = both(l);
  check(!b.program && !b.schema, `${what}: refused by the program${b.program ? " (accepted!)" : ""} and by the schema${b.schema ? " (accepted!)" : ""}`);
}
{
  const l = good() as L;
  l.steps[1].id = "satin";
  check(!!refusal(l), "two steps with the same id: refused");
  check(!!parseLesson(good(), { anchors, folder: "altra" }).ok === false, "the folder's name must be the lesson's id");
  // a range written as a plain number is accepted for counts (count: 1 = exactly one)
  const n = good() as L;
  n.steps[0].check = { selection: { count: 1 } } as never;
  check(both(n).program && both(n).schema, "selection.count as a number is accepted by both");
}

// a folder: lesson.json and its starting design
{
  const start = JSON.stringify({ version: 1, objects: [{ id: "o1" }], nova: { schemaVersion: 1 } });
  const ok = loadLessons({ prova: { "lesson.json": JSON.stringify({ ...good(), startDesign: "start.nsd" }), "start.nsd": start } }, anchors);
  check(ok.lessons.length === 1 && ok.lessons[0].startDesign?.name === "start.nsd" && ok.lessons[0].startDesign?.text === start, "a lesson with its start.nsd is loaded");
  const filum = loadLessons({ prova: { "lesson.json": JSON.stringify({ ...good(), startDesign: "start.filum" }), "start.filum": start } }, anchors);
  check(filum.lessons.length === 1, "a start design in .filum is accepted too");
  const missing = loadLessons({ prova: { "lesson.json": JSON.stringify({ ...good(), startDesign: "start.nsd" }) } }, anchors);
  check(missing.lessons.length === 0 && /start\.nsd/.test(missing.errors[0]?.message ?? ""), "a start design missing from the folder: refused");
  const other = { ...good(), startDesign: "start.nsd" };
  other.steps[1].highlight = { object: "o9" };
  const noObj = loadLessons({ prova: { "lesson.json": JSON.stringify(other), "start.nsd": start } }, anchors);
  check(noObj.lessons.length === 0 && /o9/.test(noObj.errors[0]?.message ?? ""), "highlight of an object the start design does not have: refused");
  other.steps[1].highlight = { object: "o1" };
  const noStart = loadLessons({ prova: { "lesson.json": JSON.stringify(good()) } }, anchors);
  check(noStart.lessons.length === 0 && /o1/.test(noStart.errors[0]?.message ?? ""), "highlight of an object without a start design: refused");
  const outside = loadLessons({ prova: { "lesson.json": JSON.stringify({ ...good(), startDesign: "../x.nsd" }) } }, anchors);
  check(outside.lessons.length === 0, "a start design outside the folder: refused");
  // one refused lesson does not stop the others
  const files: LessonFiles = { prova: { "lesson.json": JSON.stringify(other), "start.nsd": start }, rotta: { "lesson.json": "{" } };
  const mix = loadLessons(files, anchors);
  check(mix.lessons.length === 1 && mix.errors.length === 1 && mix.errors[0].folder === "rotta", "a refused lesson does not stop the others");
}

// the anchors come from every module's anchors.json
{
  const nova = path.resolve(here, "..");
  const found = Object.fromEntries(
    ["sequence", "view-aids", "hoops"].map((m) => [`../${m}/anchors.json`, JSON.parse(readFileSync(path.join(nova, m, "anchors.json"), "utf8"))]),
  );
  const all = declaredAnchors(found);
  check(all.has("b.panel") && all.has("c.target") && all.has("a.hoops.panel"), `the declared anchors are the modules' (${all.size})`);
  check(declaredAnchors().size === 0, "outside the app (no Vite) no anchors are found, and nothing fails");
}

done("lesson format");
