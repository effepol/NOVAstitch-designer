// Module g at start (started by module 0, nova/core/modules.ts): the lesson
// engine's commands and listeners, the lessons in the program and those in the
// app's «lessons» folder, and the progress file.

import { createElement } from "react";
import { useStore } from "../../store";
import { t } from "../core/i18n";
import { redrawCanvas, registerCanvasLayer, registerMenuItem, registerPanel } from "../core/registry";
import { tauriPrefsStore, type PrefsStore } from "../core/prefs";
import { declaredAnchors } from "./anchors";
import { currentHighlight, installEngine, onLessonChange, setLessonProgress, setLessons } from "./engine";
import { drawObjectHighlight, showAnchor } from "./highlight";
import { LessonsPanel } from "./LessonsPanel";
import { loadLessons, type LessonError, type LessonFiles, type LoadedLesson } from "./lesson";
import { openLessonProgress } from "./progress";
import { builtinFiles, readLessonFolders, tauriFolderReader, type FolderReader } from "./sources";
import "./texts";
import { GraduationCap } from "lucide-react";

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

export const LESSONS_PANEL = "g.lessons";

/** Open the Lessons tab of the layers panel. */
export function openLessonsPanel(): void {
  const s = useStore.getState();
  s.setLayout({ showOutline: true });
  s.set({ outlineTab: LESSONS_PANEL });
}

const accent = () => (globalThis.document ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() : "") || "red";

/** The interface, through module 0's registry: the panel, the Help menu item, the highlight. */
export function installLessonsUi(): () => void {
  let last: unknown = undefined;
  const follow = () => {
    const h = currentHighlight();
    const key = JSON.stringify(h);
    if (key === last) return;
    last = key;
    showAnchor(h);
    redrawCanvas();
  };
  const offs = [
    registerPanel({ id: LESSONS_PANEL, module: "g", title: "g.panel.title", order: 60, icon: GraduationCap, render: () => createElement(LessonsPanel) }),
    registerMenuItem({ id: "g.lessons", module: "g", menu: "Help", label: "g.menu.lessons", run: openLessonsPanel }),
    registerCanvasLayer({ id: "g.highlight", module: "g", draw: (ctx, info) => drawObjectHighlight(ctx, info, useStore.getState().doc, currentHighlight(), accent()) }),
    onLessonChange(follow),
  ];
  return () => {
    offs.forEach((off) => off());
    showAnchor(null);
  };
}

export async function install(): Promise<void> {
  installLessonsUi();
  await installLessons({ builtin: builtinFiles(), reader: tauriFolderReader(), store: tauriPrefsStore(), anchors: declaredAnchors() });
}
