// Module g: where lessons come from. The program's own (ui/src/nova/lessons/builtin/<id>/)
// and the «lessons» folder in the app's config folder: adding a lesson = adding a
// folder there, no code to change (g.4). Only lesson.json and the starting
// designs (.nsd, .filum) of each folder are read.

import type { LessonFiles } from "./lesson";

/** The lessons in the program (Vite finds them when it builds; none in the Node tests). */
export function builtinFiles(): LessonFiles {
  let raw: Record<string, string> = {};
  try {
    raw = import.meta.glob<string>("./builtin/*/*", { eager: true, query: "?raw", import: "default" });
  } catch {
    raw = {};
  }
  const out: LessonFiles = {};
  for (const [p, text] of Object.entries(raw)) {
    const m = /^\.\/builtin\/([^/]+)\/([^/]+)$/.exec(p);
    if (m && wanted(m[2])) (out[m[1]] ??= {})[m[2]] = text;
  }
  return out;
}

const wanted = (name: string) => name === "lesson.json" || /\.(nsd|filum)$/i.test(name);

/** A folder to read lessons from (the app's config folder, or a folder in tests). */
export interface FolderReader {
  /** The entries of a folder (relative path), or null when it does not exist. */
  list(dir: string): Promise<{ name: string; isDirectory: boolean }[] | null>;
  read(file: string): Promise<string>;
}

export const USER_LESSONS_DIR = "lessons";

/** Every lesson folder in `lessons/`: folder → file → text. A file that cannot be read is left out (the validator names what is missing). */
export async function readLessonFolders(reader: FolderReader, dir = USER_LESSONS_DIR): Promise<LessonFiles> {
  const out: LessonFiles = {};
  const top = await reader.list(dir).catch(() => null);
  for (const entry of top ?? []) {
    if (!entry.isDirectory) continue;
    const files: Record<string, string> = {};
    for (const f of (await reader.list(`${dir}/${entry.name}`).catch(() => null)) ?? []) {
      if (f.isDirectory || !wanted(f.name)) continue;
      try {
        files[f.name] = await reader.read(`${dir}/${entry.name}/${f.name}`);
      } catch (e) {
        console.error(`nova: lesson file ${dir}/${entry.name}/${f.name} unreadable`, e);
      }
    }
    out[entry.name] = files;
  }
  return out;
}

/** The app's config folder through Tauri (desktop). */
export function tauriFolderReader(): FolderReader {
  const fs = () => import("@tauri-apps/plugin-fs");
  return {
    async list(dir) {
      const { exists, readDir, BaseDirectory } = await fs();
      if (!(await exists(dir, { baseDir: BaseDirectory.AppConfig }))) return null;
      return (await readDir(dir, { baseDir: BaseDirectory.AppConfig })).map((e) => ({ name: e.name, isDirectory: e.isDirectory }));
    },
    async read(file) {
      const { readTextFile, BaseDirectory } = await fs();
      return readTextFile(file, { baseDir: BaseDirectory.AppConfig });
    },
  };
}
