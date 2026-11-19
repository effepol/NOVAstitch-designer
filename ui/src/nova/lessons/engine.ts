// Module g: the lesson engine (contract «g — Apprentice Mode»). It reads the
// state and the events and never changes the design in the user's place: the
// only things it writes are nova.lesson (through its own command) and the
// progress file. It points at the step's anchor or object, shows the hint when
// the check does not pass, and goes back to the start of the step or of the
// lesson when asked.
//
// Commands:  g.lesson.start({lessonId})  the starting design as a new design
//            g.lesson.reset({to})         back to the start of the step or of the lesson (one undo step)
// Events:    lesson.started, lesson.stepCompleted, lesson.completed
//
// nova.lesson (Architect, 19/11, an exception for nova.lesson only): its changes
// make no undo step, and Undo / Redo leave the lesson's progress as it is. The
// engine writes it with the store's setDoc without history; after an Undo or a
// Redo brings back an older nova.lesson, it writes the progress reached again.

import { useSyncExternalStore } from "react";
import { emptyDoc, useStore } from "../../store";
import type { LessonState, StitchDocument } from "../../types";
import { confirmDiscard, loadDoc } from "../../lib/actions";
import { registerCommand, runCommand } from "../core/commands";
import { emit, on } from "../core/events";
import { getLanguage } from "../core/i18n";
import { currentMode } from "../core/mode";
import { projectFormat } from "../core/project";
import { oneToOneScale } from "../core/registry";
import { novaDefaults } from "../format/nova";
import { holds, type LessonView } from "./conditions";
import type { Lang, LessonError, LoadedLesson, Step } from "./lesson";
import type { LessonProgress } from "./progress";

declare module "../core/events" {
  interface NovaEvents {
    "lesson.started": { lessonId: string; lessonRev: number; lang: Lang };
    "lesson.stepCompleted": { lessonId: string; stepId: string; index: number };
    "lesson.completed": { lessonId: string };
  }
}

interface Active {
  lesson: LoadedLesson;
  lang: Lang;
  index: number;
  completed: string[];
  status: "inProgress" | "done";
  /** The design at the start of the lesson and at the start of the current step (for reset). */
  startDoc: StitchDocument;
  stepDoc: StitchDocument;
  /** The step's waitFor event has come. */
  waited: boolean;
  /** The check did not pass after the user tried: the hint shows. */
  hint: boolean;
}

let lessons: LoadedLesson[] = [];
let refused: LessonError[] = [];
let active: Active | null = null;
let progress: LessonProgress | null = null;

// ---- React and the panel: every change bumps the version
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  for (const fn of [...listeners]) fn();
};
export function onLessonChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const useLessons = (): number => useSyncExternalStore(onLessonChange, () => version);

// ---- the lessons
export function setLessons(list: LoadedLesson[], errors: LessonError[] = []): void {
  lessons = [...list];
  refused = [...errors];
  changed();
}
export const allLessons = (): LoadedLesson[] => lessons;
/** The lessons for the current mode (Assisted or Studio). */
export const availableLessons = (): LoadedLesson[] => lessons.filter((l) => l.modes.includes(currentMode()));
export const refusedLessons = (): LessonError[] => refused;
export const lessonById = (id: string): LoadedLesson | undefined => lessons.find((l) => l.id === id);
export const setLessonProgress = (p: LessonProgress | null): void => {
  progress = p;
  changed();
};
export const lessonProgress = (): LessonProgress | null => progress;

// ---- what the panel shows
export interface CurrentStep {
  lesson: LoadedLesson;
  step: Step;
  index: number;
  count: number;
  completed: string[];
  status: "inProgress" | "done";
  hint: boolean;
}
export function currentStep(): CurrentStep | null {
  if (!active) return null;
  const { lesson, index, completed, status, hint } = active;
  return { lesson, step: lesson.steps[index], index, count: lesson.steps.length, completed: [...completed], status, hint };
}
/** What to point at now: an anchor, an object of the design, or nothing. */
export function currentHighlight(): Step["highlight"] | null {
  return active && active.status === "inProgress" ? (active.lesson.steps[active.index].highlight ?? null) : null;
}

const stateOf = (a: Active): LessonState => ({
  lessonId: a.lesson.id,
  lessonRev: a.lesson.rev,
  lang: a.lang,
  stepId: a.lesson.steps[a.index].id,
  status: a.status,
  completedSteps: [...a.completed],
});

const withLesson = (doc: StitchDocument, lesson: LessonState): StitchDocument => ({ ...doc, nova: { ...novaDefaults(), ...doc.nova, lesson } });

/** The lesson's starting design, with nova.lesson at its first step. Pure. */
export function lessonStartDoc(lesson: LoadedLesson, lang: Lang): StitchDocument {
  let doc: StitchDocument;
  if (lesson.startDesign) {
    const { name, text } = lesson.startDesign;
    const fmt = projectFormat();
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    // module a reads and migrates .nsd and .filum; without it, the JSON as it is
    doc = fmt?.extensions.includes(ext) ? fmt.read(name, new TextEncoder().encode(text)).doc : (JSON.parse(text) as StitchDocument);
  } else doc = { ...emptyDoc(), name: lesson.title[lang] };
  const first: LessonState = { lessonId: lesson.id, lessonRev: lesson.rev, lang, stepId: lesson.steps[0].id, status: "inProgress", completedSteps: [] };
  return withLesson(doc, first);
}

// ---- reading the state
function view(): LessonView {
  const s = useStore.getState();
  return { doc: s.doc, selection: s.selection, viewMode: s.viewMode, zoom: s.view.scale / oneToOneScale(), stats: s.plan?.stats ?? null };
}

function saveProgress(a: Active): void {
  const st = stateOf(a);
  progress
    ?.set(a.lesson.id, { rev: st.lessonRev, lang: st.lang, stepId: st.stepId, status: st.status, completedSteps: st.completedSteps, updated: new Date().toISOString() })
    .catch((e) => console.error("nova: lesson progress not saved", e));
}

// the current step's waitFor event
let offWait: (() => void) | null = null;
function listenWait(): void {
  offWait?.();
  offWait = null;
  const ev = active && active.status === "inProgress" ? active.lesson.steps[active.index].waitFor : undefined;
  if (!ev) return;
  offWait = on(ev, () => {
    if (!active) return;
    active.waited = true;
    schedule(true);
  });
}

function activate(a: Active | null): void {
  active = a;
  listenWait();
  changed();
}

function complete(a: Active): void {
  const step = a.lesson.steps[a.index];
  a.completed = [...a.completed.filter((s) => s !== step.id), step.id];
  const last = a.index === a.lesson.steps.length - 1;
  if (last) a.status = "done";
  else a.index++;
  a.hint = false;
  a.waited = false;
  writeLesson(a);
  a.stepDoc = useStore.getState().doc;
  saveProgress(a);
  listenWait();
  changed();
  emit("lesson.stepCompleted", { lessonId: a.lesson.id, stepId: step.id, index: a.index - (last ? 0 : 1) });
  if (last) emit("lesson.completed", { lessonId: a.lesson.id });
  // the next step may already hold (only a check, no event to wait for)
  else evaluate(false);
}

// nova.lesson in the design, with no undo step (the store's own setDoc without history)
let writing = false;
function writeLesson(a: Active): void {
  const s = useStore.getState();
  writing = true;
  try {
    s.setDoc(withLesson(s.doc, stateOf(a)), { history: false, keepSelection: true });
  } finally {
    writing = false;
  }
}
/** An Undo or a Redo brought back another nova.lesson: the progress reached goes back in, no step. */
function syncLesson(): void {
  const a = active;
  if (a && JSON.stringify(useStore.getState().doc.nova?.lesson ?? null) !== JSON.stringify(stateOf(a))) writeLesson(a);
}

/** Look at the current step. `attempt`: the user did something, so a failing check shows the hint. */
function evaluate(attempt: boolean): void {
  const a = active;
  if (!a || a.status !== "inProgress") return;
  const step = a.lesson.steps[a.index];
  if (step.waitFor && !a.waited) {
    if (attempt && pressedNext && !a.hint) {
      a.hint = true;
      changed();
    }
    return;
  }
  if (step.check) {
    if (holds(step.check, view())) return complete(a);
    if (attempt && !a.hint) {
      a.hint = true;
      changed();
    }
    return;
  }
  // no check: the event alone completes it; a reading step waits for Next
  if (step.waitFor || pressedNext) complete(a);
}

// several changes in one go (a command, then the selection…) are looked at once, after them
let pending: boolean | null = null;
let pressedNext = false;
function schedule(attempt: boolean): void {
  if (!active) return;
  const first = pending === null;
  pending = !!pending || attempt;
  if (first)
    queueMicrotask(() => {
      const at = !!pending;
      pending = null;
      syncLesson();
      evaluate(at);
    });
}

// ---- what the user asks
let starting = false;

/** g.lesson.start: the starting design as a new design (asks first if the open one is not saved). */
export function startLesson(lessonId: string, opts: { confirm?: () => boolean } = {}): boolean {
  const lesson = lessonById(lessonId);
  if (!lesson) throw new Error(`No lesson "${lessonId}"`);
  if (!(opts.confirm ?? confirmDiscard)()) return false;
  const lang: Lang = getLanguage();
  starting = true;
  try {
    loadDoc(lessonStartDoc(lesson, lang), null);
  } finally {
    starting = false;
  }
  const doc = useStore.getState().doc;
  const a: Active = { lesson, lang, index: 0, completed: [], status: "inProgress", startDoc: doc, stepDoc: doc, waited: false, hint: false };
  activate(a);
  saveProgress(a);
  emit("lesson.started", { lessonId: lesson.id, lessonRev: lesson.rev, lang });
  schedule(false);
  return true;
}

/** g.lesson.reset: back to the start of the step or of the lesson (default: what the step says). One undo step. */
export function resetLesson(to?: "start" | "step"): void {
  if (!active) return;
  runCommand("g.lesson.reset", { to: to ?? active.lesson.steps[active.index].reset });
}

/** Next: a reading step is done; any other step is checked now, and shows its hint if it does not pass. */
export function nextStep(): void {
  pressedNext = true;
  try {
    evaluate(true);
  } finally {
    pressedNext = false;
  }
}

/** Leave the lesson (the design stays as it is). */
export function stopLesson(): void {
  activate(null);
}

/** The engine's commands and listeners; returns the function that removes them. */
export function installEngine(): () => void {
  const offs = [
    registerCommand<{ lessonId: string }>({
      id: "g.lesson.start",
      label: { it: "Inizia la lezione", en: "Start the lesson" },
      apply(_doc, { lessonId }) {
        const lesson = lessonById(lessonId);
        if (!lesson) throw new Error(`No lesson "${lessonId}"`);
        return lessonStartDoc(lesson, getLanguage());
      },
    }),
    registerCommand<{ to: "start" | "step" }>({
      id: "g.lesson.reset",
      label: { it: "Ripristina la lezione", en: "Reset the lesson" },
      apply(doc, { to }) {
        if (!active) return doc;
        return to === "start" ? active.startDoc : active.stepDoc;
      },
    }),
    on("command.executed", ({ id, params }) => {
      const a = active;
      if (!a) return;
      if (id === "g.lesson.reset") {
        if ((params as { to?: string })?.to === "start") {
          a.index = 0;
          a.completed = [];
          a.status = "inProgress";
        }
        a.stepDoc = useStore.getState().doc;
        a.hint = false;
        a.waited = false;
        saveProgress(a);
        listenWait();
        changed();
      } else if (id === "g.lesson.start") {
        // run as a command (one undo step) instead of startLesson: the lesson starts on the design it gave
        const st = useStore.getState().doc.nova?.lesson;
        const lesson = st ? lessonById(st.lessonId) : undefined;
        if (!st || !lesson) return;
        const doc = useStore.getState().doc;
        activate({ lesson, lang: st.lang, index: 0, completed: [], status: "inProgress", startDoc: doc, stepDoc: doc, waited: false, hint: false });
        saveProgress(active!);
        emit("lesson.started", { lessonId: lesson.id, lessonRev: lesson.rev, lang: st.lang });
      }
    }),
    // the user's changes are attempts; the engine's own are not
    on("doc.changed", ({ commandId }) => {
      if (!writing && !commandId?.startsWith("g.lesson.")) schedule(true);
    }),
    on("selection.changed", () => schedule(false)),
    on("view.changed", () => schedule(false)),
    on("plan.ready", () => schedule(false)),
    // another design: a lesson saved half-way goes on where it was, any other design ends the lesson
    on("doc.loaded", () => {
      if (starting) return;
      const doc = useStore.getState().doc;
      const st = doc.nova?.lesson;
      const lesson = st ? lessonById(st.lessonId) : undefined;
      const index = lesson && st ? lesson.steps.findIndex((s) => s.id === st.stepId) : -1;
      if (!lesson || !st || st.status !== "inProgress" || st.lessonRev !== lesson.rev || index < 0) return activate(null);
      activate({ lesson, lang: st.lang, index, completed: [...st.completedSteps], status: "inProgress", startDoc: lessonStartDoc(lesson, st.lang), stepDoc: doc, waited: false, hint: false });
      schedule(false);
    }),
  ];
  return () => {
    offs.forEach((off) => off());
    activate(null);
  };
}
