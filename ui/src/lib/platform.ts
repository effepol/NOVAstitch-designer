// Abstracts file access: native dialogs + filesystem through Tauri.
// NOVAstitch Designer is a desktop app only (Windows, macOS, Linux): the
// browser fallbacks of Filum are gone (contract, section 2).

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Outside the desktop app (a page opened in a browser) there is no file access. */
const desktopOnly = (): never => {
  throw new Error("NOVAstitch Designer works as a desktop app only");
};

/** Open a web page in the system browser. */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri) desktopOnly();
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

export interface OpenedFile {
  name: string;
  path: string | null;
  bytes: Uint8Array;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export async function openFile(filters: FileFilter[]): Promise<OpenedFile | null> {
  if (!isTauri) desktopOnly();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, directory: false, filters });
  if (!path || Array.isArray(path)) return null;
  const bytes = await readFile(path);
  return { name: path.split(/[\\/]/).pop() ?? path, path, bytes };
}

/** Save bytes. Returns the chosen path, or null if cancelled. */
export async function saveFile(
  suggestedName: string,
  bytes: Uint8Array,
  filters: FileFilter[],
  existingPath?: string | null,
): Promise<string | null> {
  if (!isTauri) desktopOnly();
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const path = existingPath ?? (await save({ defaultPath: suggestedName, filters }));
  if (!path) return null;
  await writeFile(path, bytes);
  return path;
}

export const enc = new TextEncoder();
export const dec = new TextDecoder();

/** A file of a picked folder, read lazily. */
export interface FolderFile {
  path: string;
  text: () => Promise<string>;
  bytes: () => Promise<Uint8Array>;
}

/** A picked folder's files with these extensions (recursive, paths relative to it), read lazily. */
/** A picked folder's files with these extensions (recursive, paths relative to it), read lazily. */
export async function openFolder(extensions: string[] = ["svg", "json"]): Promise<FolderFile[] | null> {
  if (!isTauri) desktopOnly();
  const want = (name: string) => extensions.includes(name.split(".").pop()?.toLowerCase() ?? "");
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readDir, readTextFile, readFile } = await import("@tauri-apps/plugin-fs");
  const dir = await open({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return null;
  const out: FolderFile[] = [];
  const walk = async (d: string, rel: string, depth: number) => {
    if (depth > 3) return;
    for (const e of await readDir(d)) {
      const p = `${d}/${e.name}`;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory) await walk(p, r, depth + 1);
      else if (want(e.name)) out.push({ path: r, text: () => readTextFile(p), bytes: () => readFile(p) });
    }
  };
  await walk(dir, "", 0);
  return out;
}
