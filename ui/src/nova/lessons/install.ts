// Module g at start (started by module 0, nova/core/modules.ts): the lesson
// engine's commands and listeners, the lessons in the program and those in the
// app's «lessons» folder, and the progress file.

import { t } from "../core/i18n";
import { tauriPrefsStore, type PrefsStore } from "../core/prefs";
import { declaredAnchors } from "./anchors";
import { installEngine, setLessonProgress, setLessons } from "./engine";
import { loadLessons, type LessonError, type LessonFiles, type LoadedLesson } from "./lesson";
import { openLessonProgress } from "./progress";
import { builtinFiles, readLessonFolders, tauriFolderReader, type FolderReader } from "./sources";
import "./texts";

/** The program's lessons and the user's: a user lesson with the id of one of the program's is refused. */
export function mergeLessons(builtin: LessonFiles, user: LessonFiles, anchors: ReadonlySet<string>): { lessons: LoadedLesson[]; errors: LessonError[] } {
  const a = loadLessons(builtin, anchors, "builtin");
  const b = loadLessons(user, anchors, "user");
  const taken = new Set(a.lessons.map((l) => l.id));
  const errors = [...a.errors, ...b.errors];
  const mine = b.lessons.filter((l) => {
    if (!taken.has(l.id)) return true;
    errors.push({ folder: l.id, message: t("g.err.refused", { folder: l.id, why: t("g.err.idTaken") }) });
    return false;
  });
  return { lessons: [...a.lessons, ...mine], errors };
}

export interface LessonDeps {
  builtin: LessonFiles;
  reader: FolderReader | null;
  store: PrefsStore | null;
  anchors: ReadonlySet<string>;
}

let deps: LessonDeps | null = null;

/** Read the lesson folders again (the panel's Reload): a folder added meanwhile shows up. */
export async function reloadLessons(): Promise<void> {
  if (!deps) return;
  const user = deps.reader ? await readLessonFolders(deps.reader) : {};
  const { lessons, errors } = mergeLessons(deps.builtin, user, deps.anchors);
  for (const e of errors) console.error(`nova: ${e.message}`);
  setLessons(lessons, errors);
}

export async function installLessons(d: LessonDeps): Promise<() => void> {
  deps = d;
  const off = installEngine();
  // the program's lessons at once, the user's folder as soon as it is read
  const first = mergeLessons(d.builtin, {}, d.anchors);
  setLessons(first.lessons, first.errors);
  await reloadLessons().catch((e) => console.error("nova: lessons folder unreadable", e));
  if (d.store) setLessonProgress(await openLessonProgress(d.store).catch(() => null));
  return () => {
    off();
    deps = null;
    setLessons([]);
    setLessonProgress(null);
  };
}

export async function install(): Promise<void> {
  await installLessons({ builtin: builtinFiles(), reader: tauriFolderReader(), store: tauriPrefsStore(), anchors: declaredAnchors() });
}
