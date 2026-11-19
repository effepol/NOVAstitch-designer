// Module g: the lesson engine on the real store and bus (contract «g — Apprentice Mode»).
//   g.1  step «draw a satin 3–5 mm wide»: 4 mm → step completed; 6 mm → not, the hint shows
//   g.2  a lesson from start to end → lesson.completed; nova.lesson.status = "done"
//   g.3  reset of the step → the design as it was at the start of the step
//   g.4  a new folder in lessons/ without code changes → the lesson is in the list and runs
//   g.7  the same lesson in Italian and in English → same steps and checks, only the texts change
// Also: the engine never changes the user's objects; progress goes to lesson-progress.json.

import { check, done } from "../core/testkit";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { emptyDoc, useStore } from "../../store";
import { installBridge } from "../core/bridge";
import { on } from "../core/events";
import { setLanguage } from "../core/i18n";
import { runCommand } from "../core/commands";
import type { PrefsStore } from "../core/prefs";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject, StitchDocument } from "../../types";
import { holds } from "./conditions";
import { allLessons, availableLessons, currentHighlight, currentStep, nextStep, resetLesson, startLesson, stopLesson } from "./engine";
import { installLessons, reloadLessons } from "./install";
import { LESSON_PROGRESS_FILE } from "./progress";
import type { FolderReader } from "./sources";

installBridge();
const st = () => useStore.getState();
const tick = () => new Promise((r) => setTimeout(r, 0));
const anchors = new Set(["b.panel", "c.target"]);
const yes = () => true;

// ---- a lesson folder on disk (g.4: the app's «lessons» folder)
const root = mkdtempSync(path.join(tmpdir(), "nova-lessons-"));
const startDoc: StitchDocument = { ...emptyDoc(), name: "Partenza", objects: [] };
const lessonJson = {
  id: "prova-satin",
  rev: 1,
  path: "vector",
  title: { it: "Prova satin", en: "Satin test" },
  modes: ["assisted", "studio"],
  startDesign: "start.nsd",
  steps: [
    {
      id: "disegna",
      text: { it: "Disegna un satin largo 3–5 mm.", en: "Draw a satin 3–5 mm wide." },
      highlight: "b.panel",
      check: { exists: { type: "satin", param: { width: { min: 3, max: 5 } } } },
      hint: { it: "Cambia la larghezza nel pannello del punto.", en: "Change the width in the stitch panel." },
      reset: "step",
    },
    {
      id: "seleziona",
      text: { it: "Seleziona il satin.", en: "Select the satin." },
      check: { selection: { count: 1 } },
      hint: { it: "Fai clic sul satin.", en: "Click the satin." },
      reset: "step",
    },
    {
      id: "fine",
      text: { it: "Hai finito. Premi Avanti.", en: "You are done. Press Next." },
      hint: { it: "Premi Avanti.", en: "Press Next." },
      reset: "start",
    },
  ],
};
const write = (dir: string, files: Record<string, string>) => {
  mkdirSync(path.join(root, "lessons", dir), { recursive: true });
  for (const [f, text] of Object.entries(files)) writeFileSync(path.join(root, "lessons", dir, f), text);
};
write("prova-satin", { "lesson.json": JSON.stringify(lessonJson), "start.nsd": JSON.stringify(startDoc) });

const reader: FolderReader = {
  async list(dir) {
    try {
      return readdirSync(path.join(root, dir), { withFileTypes: true }).map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
    } catch {
      return null;
    }
  },
  read: async (f) => readFileSync(path.join(root, f), "utf8"),
};
const files = new Map<string, string>();
const store: PrefsStore = {
  read: async (n) => files.get(n) ?? null,
  write: async (n, t) => void files.set(n, t),
  rename: async (a, b) => {
    files.set(b, files.get(a)!);
    files.delete(a);
  },
  remove: async (n) => void files.delete(n),
};

const events: string[] = [];
for (const e of ["lesson.started", "lesson.stepCompleted", "lesson.completed"]) on(e, (p) => events.push(`${e}:${JSON.stringify(p)}`));

const satin = (id: string, width: number): DesignObject => ({
  id,
  name: id,
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: false, nodes: [{ p: [10, 10] }, { p: [40, 10] }] }],
  stitch: { ...(defaultStitch("satin") as DesignObject["stitch"] & { type: "satin" }), width },
});
/** The user draws (Filum's commit, as its tools do). */
const draw = (o: DesignObject) => st().commit((d) => ({ ...d, objects: [...d.objects, o] }));
const setWidth = (id: string, width: number) => st().commit((d) => ({ ...d, objects: d.objects.map((o) => (o.id === id ? { ...o, stitch: { ...o.stitch, width } as DesignObject["stitch"] } : o)) }));
const userObjects = () => JSON.stringify(st().doc.objects);

async function main() {
  await installLessons({ builtin: {}, reader, store, anchors });

  // g.4: the folder's lesson is in the list (no code knows it)
  check(allLessons().some((l) => l.id === "prova-satin" && l.source === "user"), "g.4 the lesson of the new folder is in the list");
  check(availableLessons().length === 1, "the lesson is offered in Studio (its modes include studio)");

  // ---- g.1, g.2 in Italian
  setLanguage("it");
  useStore.setState({ doc: { ...emptyDoc(), objects: [satin("altro", 4)] }, saved: true });
  check(startLesson("prova-satin", { confirm: yes }), "g.lesson.start opens the lesson");
  await tick();
  check(st().doc.objects.length === 0 && st().doc.name === "Partenza" && st().past.length === 0, "the starting design is opened as a new design (no undo back to the old one)");
  check(st().doc.nova?.lesson?.lessonId === "prova-satin" && st().doc.nova?.lesson?.stepId === "disegna" && st().doc.nova?.lesson?.status === "inProgress", "nova.lesson is at the first step");
  check(events[0]?.startsWith("lesson.started") && events[0].includes('"lang":"it"'), `lesson.started is sent (${events[0]})`);
  check(currentStep()?.step.id === "disegna" && !currentStep()?.hint, "first step, no hint yet");
  check(JSON.stringify(currentHighlight()) === '"b.panel"', "the step's anchor is the one to highlight");

  // g.1: 6 mm → no, the hint shows
  draw(satin("s1", 6));
  await tick();
  check(currentStep()?.step.id === "disegna" && currentStep()?.hint === true, "g.1 a satin 6 mm wide: the step is not completed and the hint shows");
  check(st().doc.objects.length === 1 && (st().doc.objects[0].stitch as { width: number }).width === 6, "g.1 the engine leaves the user's satin as it is");

  // g.3: reset of the step → the design at the start of the step
  const before = JSON.stringify(st().doc);
  resetLesson("step");
  check(JSON.stringify({ ...st().doc, name: st().doc.name }) !== before && st().doc.objects.length === 0, "g.3 reset of the step: the satin drawn in the step is gone");
  const atStepStart = JSON.stringify(st().doc);
  draw(satin("s1", 6));
  await tick();
  resetLesson();
  check(JSON.stringify(st().doc) === atStepStart, "g.3 reset (the step's own: «step») gives back the design exactly as at the start of the step");
  check(!currentStep()?.hint, "after a reset the hint is gone");
  st().undo();
  check(st().doc.objects.length === 1, "a reset is one undo step");
  setWidth("s1", 6);
  await tick();

  // g.1: 4 mm → completed
  setWidth("s1", 4);
  await tick();
  check(currentStep()?.step.id === "seleziona", "g.1 a satin 4 mm wide: the step is completed");
  check(st().doc.nova?.lesson?.stepId === "seleziona" && st().doc.nova?.lesson?.completedSteps.join() === "disegna", "nova.lesson follows: second step, first done");
  check(events.some((e) => e.startsWith("lesson.stepCompleted") && e.includes('"stepId":"disegna"')), "lesson.stepCompleted is sent");
  const objectsAfter = userObjects();

  // g.3 on the second step: back to its start (the 4 mm satin is still there)
  st().select(["s1"]);
  await tick();
  check(currentStep()?.step.id === "fine", "selecting the satin completes the second step");
  const stepThree = JSON.stringify(st().doc);
  draw(satin("s2", 9));
  await tick();
  resetLesson("step");
  check(JSON.stringify(st().doc) === stepThree, "g.3 reset on a later step: the design of that step's start");
  check(userObjects() === objectsAfter, "the engine never changed the user's objects (only nova.lesson)");

  // a reading step: no check, it waits for Next
  check(currentStep()?.step.id === "fine" && currentStep()?.status === "inProgress", "a reading step does not complete by itself");
  nextStep();
  // g.2
  check(currentStep()?.status === "done" && st().doc.nova?.lesson?.status === "done", "g.2 the lesson done: nova.lesson.status = \"done\"");
  check(events.some((e) => e.startsWith("lesson.completed") && e.includes("prova-satin")), "g.2 lesson.completed is sent");
  check(currentHighlight() === null, "a finished lesson highlights nothing");
  await tick();
  const saved = JSON.parse(files.get(LESSON_PROGRESS_FILE) ?? "{}");
  check(
    saved.schemaVersion === 1 && saved.lessons?.["prova-satin"]?.status === "done" && saved.lessons["prova-satin"].completedSteps.join() === "disegna,seleziona,fine",
    `the progress is in lesson-progress.json, with its schemaVersion (${files.get(LESSON_PROGRESS_FILE)?.slice(0, 80)}…)`,
  );

  // reset to the start of the lesson
  resetLesson("start");
  check(st().doc.objects.length === 0 && currentStep()?.index === 0 && currentStep()?.status === "inProgress", "reset to the start: the starting design and the first step");

  // ---- g.7: the same lesson in English
  const itRun = { steps: allLessons()[0].steps.map((s) => [s.id, JSON.stringify(s.check ?? null), JSON.stringify(s.highlight ?? null), s.reset]) };
  setLanguage("en");
  events.length = 0;
  stopLesson();
  check(startLesson("prova-satin", { confirm: yes }), "g.7 the lesson starts in English");
  await tick();
  check(st().doc.nova?.lesson?.lang === "en" && events[0].includes('"lang":"en"'), "g.7 nova.lesson.lang is en");
  draw(satin("e1", 6));
  await tick();
  const hintEn = currentStep()?.hint === true && currentStep()?.step.hint.en === "Change the width in the stitch panel.";
  setWidth("e1", 4);
  await tick();
  st().select(["e1"]);
  await tick();
  nextStep();
  const enRun = { steps: allLessons()[0].steps.map((s) => [s.id, JSON.stringify(s.check ?? null), JSON.stringify(s.highlight ?? null), s.reset]) };
  check(hintEn && currentStep()?.status === "done", "g.7 in English: same outcome (6 mm hint, 4 mm passes, select, Next → done)");
  check(JSON.stringify(itRun) === JSON.stringify(enRun) && events.filter((e) => e.startsWith("lesson.stepCompleted")).length === 3, "g.7 same steps and checks; only the texts differ");
  const l = allLessons()[0];
  check(l.steps.every((s) => s.text.it !== s.text.en && s.hint.it !== s.hint.en), "g.7 the texts differ between the two languages");

  // ---- a design saved half-way goes on where it was
  stopLesson();
  setLanguage("it");
  startLesson("prova-satin", { confirm: yes });
  draw(satin("r1", 4));
  await tick();
  const half = st().doc;
  stopLesson();
  check(currentStep() === null, "leaving the lesson");
  const { loadDoc } = await import("../../lib/actions");
  loadDoc(JSON.parse(JSON.stringify(half)), "/tmp/x.nsd");
  await tick();
  check(currentStep()?.step.id === "seleziona", "opening a design saved half-way: the lesson goes on at its step");
  loadDoc({ ...emptyDoc() }, null);
  check(currentStep() === null, "opening another design ends the lesson");

  // ---- g.4 again: a folder added while the program runs shows up at Reload
  write("seconda", { "lesson.json": JSON.stringify({ ...lessonJson, id: "seconda", startDesign: undefined, steps: [lessonJson.steps[2]] }) });
  write("rotta", { "lesson.json": JSON.stringify({ ...lessonJson, id: "rotta", steps: [{ ...lessonJson.steps[0], check: { magia: true } }] }), "start.nsd": "{}" });
  await reloadLessons();
  check(allLessons().some((l) => l.id === "seconda"), "g.4 a folder added later is in the list after Reload");
  check(!allLessons().some((l) => l.id === "rotta"), "g.5 a lesson with an unknown condition is left out of the list");
  check(startLesson("seconda", { confirm: yes }), "g.4 the new lesson runs");
  nextStep();
  check(currentStep()?.status === "done", "g.4 the new lesson runs to its end");

  // ---- the conditions on their own
  const v = { doc: { ...emptyDoc(), objects: [satin("a", 3), satin("b", 5.5)] }, selection: ["a"], viewMode: "stitch" as const, zoom: 2, stats: null };
  check(holds({ exists: { type: "satin", param: { width: { min: 3, max: 5 } }, count: 1 } }, v), "exists with count");
  check(!holds({ exists: { type: "satin", param: { width: { min: 3, max: 5 } }, count: { min: 2 } } }, v), "exists: too few");
  check(holds({ exists: { type: "satin", method: "satin" } }, v) && !holds({ exists: { type: "satin", method: "zigzag" } }, v), "exists with method");
  check(holds({ exists: { type: "fill", count: 0 } }, v), "exists with count 0: none of them");
  check(holds({ view: { mode: "stitch", zoom: { min: 1.5 } } }, v) && !holds({ view: { mode: "vector" } }, v), "view");
  check(holds({ selection: { count: 1 } }, v) && !holds({ selection: { count: { min: 2 } } }, v), "selection");
  check(!holds({ plan: { stitches: { min: 1 } } }, v), "plan: not ready yet, so it does not hold");
  const withPlan = { ...v, stats: { stitches: 900, jumps: 0, trims: 2, colorChanges: 1, stops: 0, width: 0, height: 0, threadM: 0, bobbinM: 0, seconds: 0, threadPerColorM: [], stitchesPerColor: [] } };
  check(holds({ plan: { stitches: { min: 500, max: 1000 }, trims: { max: 2 } } }, withPlan) && !holds({ plan: { colorChanges: { min: 2 } } }, withPlan), "plan");
  check(holds({ all: [{ selection: { count: 1 } }, { not: [{ view: { mode: "vector" } }] }] }, v) && holds({ any: [{ view: { mode: "vector" } }, { selection: { count: 1 } }] }, v), "all, any, not");

  // the commands are in the registry under the contract's names
  check(["g.lesson.start", "g.lesson.reset"].every((id) => { try { runCommand(id === "g.lesson.start" ? id : "g.lesson.reset", id === "g.lesson.start" ? { lessonId: "prova-satin" } : { to: "step" }); return true; } catch { return false; } }), "g.lesson.start and g.lesson.reset are registered commands");
  done("lesson engine");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
