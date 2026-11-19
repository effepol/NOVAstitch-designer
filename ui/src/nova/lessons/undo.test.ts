// Module g — decision of the Architect (19/11, an exception for nova.lesson only):
// changes of nova.lesson make no undo step, and Undo / Redo leave the lesson's
// progress as it is.
//   step completed → Ctrl+Z undoes the user's last action; the lesson stays at the step reached

import { check, done } from "../core/testkit";
import { emptyDoc, useStore } from "../../store";
import { installBridge } from "../core/bridge";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject } from "../../types";
import { currentStep, startLesson } from "./engine";
import { installLessons } from "./install";

installBridge();
const st = () => useStore.getState();
const tick = () => new Promise((r) => setTimeout(r, 0));

const lesson = {
  id: "annulla",
  rev: 1,
  path: "vector",
  title: { it: "Annulla", en: "Undo" },
  modes: ["assisted", "studio"],
  steps: [
    {
      id: "satin",
      text: { it: "Disegna un satin largo 3–5 mm.", en: "Draw a satin 3–5 mm wide." },
      check: { exists: { type: "satin", param: { width: { min: 3, max: 5 } } } },
      hint: { it: "Larghezza tra 3 e 5 mm.", en: "Width between 3 and 5 mm." },
      reset: "step",
    },
    {
      id: "due",
      text: { it: "Disegna un secondo satin.", en: "Draw a second satin." },
      check: { exists: { type: "satin", count: { min: 2 } } },
      hint: { it: "Ne serve un altro.", en: "One more." },
      reset: "step",
    },
    { id: "fine", text: { it: "Fine.", en: "The end." }, hint: { it: "Avanti.", en: "Next." }, reset: "start" },
  ],
};
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
const draw = (o: DesignObject) => st().commit((d) => ({ ...d, objects: [...d.objects, o] }));

async function main() {
  await installLessons({ builtin: { annulla: { "lesson.json": JSON.stringify(lesson) } }, reader: null, store: null, anchors: new Set() });
  useStore.setState({ doc: emptyDoc(), saved: true });
  startLesson("annulla", { confirm: () => true });
  await tick();
  check(st().past.length === 0, "the lesson starts with no undo step");

  draw(satin("a", 4));
  await tick();
  check(currentStep()?.step.id === "due" && st().doc.nova?.lesson?.stepId === "due", "the first step is completed; nova.lesson is at the second");
  check(st().past.length === 1, `completing a step adds no undo step (undo steps: ${st().past.length}, only the user's drawing)`);

  // Ctrl+Z: the user's satin goes, the lesson stays at the step reached
  st().undo();
  await tick();
  check(st().doc.objects.length === 0, "Ctrl+Z undoes the user's last action (the satin)");
  check(currentStep()?.step.id === "due" && st().doc.nova?.lesson?.stepId === "due" && st().doc.nova?.lesson?.completedSteps.join() === "satin", "after Ctrl+Z the lesson stays at the step reached, in the engine and in nova.lesson");
  check(st().past.length === 0 && st().future.length === 1, "the lesson's write after Undo adds no step and keeps Redo");

  // Ctrl+Y: the satin comes back, the lesson does not move
  st().redo();
  await tick();
  check(st().doc.objects.length === 1 && currentStep()?.step.id === "due" && st().doc.nova?.lesson?.stepId === "due", "Redo brings the satin back; the lesson stays where it was");
  check(st().past.length === 1 && st().future.length === 0, "Redo is one step, as for the user");

  // the next step, then two Undo: the lesson never goes back
  draw(satin("b", 4));
  await tick();
  check(currentStep()?.step.id === "fine" && st().past.length === 2, "second step completed, still only the user's two steps");
  st().undo();
  st().undo();
  await tick();
  check(st().doc.objects.length === 0 && currentStep()?.step.id === "fine" && st().doc.nova?.lesson?.completedSteps.join() === "satin,due", "two Undo: the drawings go, the lesson stays at its last step");

  // the user's own steps stay one each: the selection is kept, nothing else is undone by the lesson's writes
  check(st().past.length === 0 && st().future.length === 2, "the undo history holds only the user's actions");
  done("lesson and undo");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
