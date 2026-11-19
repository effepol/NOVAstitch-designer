// Module g: how far the user got in each lesson. App data, not project data
// (contract, section 3): lesson-progress.json in the app's config folder, with
// its schemaVersion, written in two steps (a temporary file, then renamed over
// the old one). The design keeps only nova.lesson.

import type { PrefsStore } from "../core/prefs";
import { tidyStringify } from "../format/numbers";

export const LESSON_PROGRESS_FILE = "lesson-progress.json";
export const LESSON_PROGRESS_SCHEMA = 1;

export interface LessonProgressEntry {
  rev: number;
  lang: "it" | "en";
  stepId: string;
  status: "inProgress" | "done";
  completedSteps: string[];
  /** ISO date of the last change. */
  updated: string;
}

export interface LessonProgress {
  get(lessonId: string): LessonProgressEntry | undefined;
  all(): Record<string, LessonProgressEntry>;
  set(lessonId: string, entry: LessonProgressEntry): Promise<void>;
  /** Only once `confirm` says yes; returns whether it did. */
  remove(lessonId: string, confirm: () => Promise<boolean> | boolean): Promise<boolean>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validEntry = (e: unknown): e is LessonProgressEntry =>
  isObj(e) &&
  Number.isInteger(e.rev) &&
  (e.lang === "it" || e.lang === "en") &&
  typeof e.stepId === "string" &&
  (e.status === "inProgress" || e.status === "done") &&
  Array.isArray(e.completedSteps) &&
  e.completedSteps.every((s) => typeof s === "string") &&
  typeof e.updated === "string";

export async function openLessonProgress(store: PrefsStore): Promise<LessonProgress> {
  let lessons: Record<string, LessonProgressEntry> = {};
  try {
    const text = await store.read(LESSON_PROGRESS_FILE);
    const parsed = text ? JSON.parse(text) : null;
    if (isObj(parsed) && isObj(parsed.lessons)) lessons = Object.fromEntries(Object.entries(parsed.lessons).filter(([, e]) => validEntry(e))) as Record<string, LessonProgressEntry>;
  } catch (e) {
    // damaged: start empty; the file is replaced at the next change
    console.error(`nova: ${LESSON_PROGRESS_FILE} unreadable`, e);
  }

  let pendingLessons = lessons;
  // one write at a time: two saves must not share the temporary file
  let queue: Promise<void> = Promise.resolve();
  const save = (next: Record<string, LessonProgressEntry>): Promise<void> => {
    const run = queue.then(() => write(next));
    queue = run.catch(() => {});
    return run;
  };
  const write = async (next: Record<string, LessonProgressEntry>) => {
    const tmp = `${LESSON_PROGRESS_FILE}.tmp`;
    await store.write(tmp, `${tidyStringify({ schemaVersion: LESSON_PROGRESS_SCHEMA, lessons: next }, 2)}\n`);
    try {
      await store.rename(tmp, LESSON_PROGRESS_FILE);
    } catch (e) {
      await store.remove?.(tmp).catch(() => {});
      throw e;
    }
    lessons = next;
  };

  return {
    get: (id) => pendingLessons[id],
    all: () => ({ ...pendingLessons }),
    set: (id, entry) => {
      // the list as it is now (with the writes still waiting), so no change is lost
      pendingLessons = { ...pendingLessons, [id]: { ...entry, completedSteps: [...entry.completedSteps] } };
      return save(pendingLessons);
    },
    async remove(id, confirm) {
      if (!(id in pendingLessons) || !(await confirm())) return false;
      const next = { ...pendingLessons };
      delete next[id];
      pendingLessons = next;
      await save(next);
      return true;
    },
  };
}
