// Module n: loading the library — the files in the program (library/*.json)
// and the user's folder «varieta/» in the app's data (desktop only, through
// Tauri). Loaded at start and again when the list is shown, so a file added
// to the folder becomes an entry.

import { loadVarieties, setVarietyList, userVarietyFiles, type FolderReader } from "./varieties";

/** The variety files in the program: file name → text (Vite finds them; none in the Node tests). */
export function shippedFiles(): Record<string, string> {
  try {
    return import.meta.glob<string>("./library/*.json", { eager: true, query: "?raw", import: "default" });
  } catch {
    return {};
  }
}

/** The app's data folder through Tauri (desktop); null outside the app. */
export function tauriFolderReader(): FolderReader | null {
  const w = globalThis as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!w.__TAURI_INTERNALS__) return null;
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

let shipped: Record<string, string> = {};
let reader: FolderReader | null = null;

/** Where the library comes from (install sets it; tests give their own). */
export function setSources(files: Record<string, string>, user: FolderReader | null): void {
  shipped = files;
  reader = user;
}

/** Read the library again: the program's files, then the user's folder. */
export async function reloadVarieties(): Promise<void> {
  setVarietyList(loadVarieties(shipped));
  if (!reader) return;
  const user = await userVarietyFiles(reader).catch(() => ({}));
  setVarietyList(loadVarieties(shipped, user));
}
