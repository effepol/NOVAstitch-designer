// Module g: the example lesson in the program (builtin/satin-largo), the one the
// tests run; the real lessons come in a later release.
//   g.1  «set the satin's width to 3–5 mm»: 4 mm → step completed; 6 mm → not, the hint shows
//   g.2  the lesson from start to end → lesson.completed; nova.lesson.status = "done"
//   g.7  the same lesson in Italian and in English → same steps and checks, only the texts change
// Also: its file validates against lesson.schema.json, and its start.nsd is read by module a's format.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { useStore } from "../../store";
import { installBridge } from "../core/bridge";
import { on } from "../core/events";
import { setLanguage } from "../core/i18n";
import { registerProjectFormat } from "../core/project";
import { readProject } from "../format/read";
import type { DesignObject } from "../../types";
import { allLessons, currentHighlight, currentStep, nextStep, startLesson, stopLesson } from "./engine";
import { installLessons } from "./install";
import type { LessonFiles } from "./lesson";

installBridge();
// module a's reading of .nsd (migration included), as in the app
registerProjectFormat({ module: "a", extensions: ["nsd", "filum"], filterName: () => "", read: readProject, save: async () => null });
const st = () => useStore.getState();
const tick = () => new Promise((r) => setTimeout(r, 0));
const here = path.resolve(process.cwd(), "src/nova/lessons");
const nova = path.resolve(here, "..");

// the program's lessons, as Vite gives them (./builtin/<id>/<file>)
const builtin: LessonFiles = {};
for (const id of readdirSync(path.join(here, "builtin"))) {
  builtin[id] = {};
  for (const f of readdirSync(path.join(here, "builtin", id))) builtin[id][f] = readFileSync(path.join(here, "builtin", id, f), "utf8");
}
check(Object.keys(builtin).join() === "satin-largo", "one example lesson in the program, no series of lessons");
const schema = JSON.parse(readFileSync(path.join(here, "lesson.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
check(validate(JSON.parse(builtin["satin-largo"]["lesson.json"])) === true, "the example validates against lesson.schema.json");
// every module's anchors, as declaredAnchors() finds them in the app
const anchors = new Set<string>();
for (const m of readdirSync(nova)) {
  try {
    for (const k of Object.keys(JSON.parse(readFileSync(path.join(nova, m, "anchors.json"), "utf8")))) anchors.add(k);
  } catch {
    // a folder without anchors.json
  }
}

const events: string[] = [];
for (const e of ["lesson.started", "lesson.stepCompleted", "lesson.completed"]) on(e, (p) => events.push(`${e}:${JSON.stringify(p)}`));
const width = (w: number) => st().commit((d) => ({ ...d, objects: d.objects.map((o) => (o.id === "colonna" ? { ...o, stitch: { ...o.stitch, width: w } as DesignObject["stitch"] } : o)) }));

/** The lesson run by a user in `lang`: what happened, step by step. */
async function run(lang: "it" | "en"): Promise<string[]> {
  setLanguage(lang);
  events.length = 0;
  const seen: string[] = [];
  const note = (what: string) => seen.push(`${what}|${currentStep()?.step.id}|${currentStep()?.status}|${currentStep()?.hint}|${JSON.stringify(currentHighlight())}`);
  check(startLesson("satin-largo", { confirm: () => true }), `${lang}: the example starts`);
  await tick();
  note("start");
  check(st().doc.objects.length === 1 && (st().doc.objects[0].stitch as { width: number }).width === 2, `${lang}: the starting design (one satin 2 mm wide)`);
  st().select(["colonna"]);
  await tick();
  note("select");
  width(6);
  await tick();
  note("6mm");
  check(currentStep()?.step.id === "larghezza" && currentStep()?.hint === true, `g.1 ${lang}: 6 mm → the step is not completed, the hint shows`);
  width(4);
  await tick();
  note("4mm");
  check(currentStep()?.step.id === "fine", `g.1 ${lang}: 4 mm → the step is completed`);
  nextStep();
  note("next");
  check(currentStep()?.status === "done" && st().doc.nova?.lesson?.status === "done" && st().doc.nova?.lesson?.lang === lang, `g.2 ${lang}: nova.lesson.status = "done"`);
  check(events.some((e) => e.startsWith("lesson.completed:") && e.includes("satin-largo")), `g.2 ${lang}: lesson.completed is sent`);
  stopLesson();
  return seen;
}

async function main() {
  await installLessons({ builtin, reader: null, store: null, anchors });
  check(allLessons().map((l) => l.id).join() === "satin-largo", "the example is accepted by the validator");
  const it = await run("it");
  const en = await run("en");
  check(it.join() === en.join(), `g.7 the same steps, checks and highlights in Italian and in English (${en.join(" ; ")})`);
  const l = allLessons()[0];
  check([l.title, ...l.steps.flatMap((s) => [s.text, s.hint])].every((x) => x.it.trim() && x.en.trim() && x.it !== x.en), "g.7 only the texts change: every text in both languages");
  done("example lesson");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
