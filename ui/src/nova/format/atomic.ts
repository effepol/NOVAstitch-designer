// Writing a project in two steps (module a): the bytes go to a temporary file
// in the same folder, are read back and compared, and only then is the
// temporary file renamed over the old one. Whatever fails, the old file keeps
// its bytes and the temporary file is removed; a leftover from a crash is
// removed by the next save of the same file. Only .nsd files are ever written.

/** The file system as module a uses it: the desktop app's (Tauri), or the disk in the tests. */
export interface FileOps {
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** Reads the temporary file back before the rename (a short write is caught there). */
  read?(path: string): Promise<Uint8Array>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** The names in a folder: leftovers of a crash are cleaned up. */
  list?(dir: string): Promise<string[]>;
}

/** Writing anything but a .nsd (a .filum above all) is refused before any byte is written. */
export class NotNsdError extends Error {
  constructor(readonly path: string) {
    super(`NOVAstitch writes only .nsd files, not ${path}`);
    this.name = "NotNsdError";
  }
}

export const isNsd = (path: string) => /\.nsd$/i.test(path);

/** Folder (with its separator) and name of a path, Windows or POSIX. */
export function splitPath(path: string): { dir: string; name: string } {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}

/** The temporary files of `name`: ".<name>.<random>.nsd-tmp". */
const TMP_SUFFIX = ".nsd-tmp";
const isTmpOf = (entry: string, name: string) => entry.startsWith(`.${name}.`) && entry.endsWith(TMP_SUFFIX);

const random = () => Math.random().toString(36).slice(2, 10);

export async function writeAtomic(fs: FileOps, path: string, bytes: Uint8Array): Promise<void> {
  if (!isNsd(path)) throw new NotNsdError(path);
  const { dir, name } = splitPath(path);

  // leftovers of an earlier save of this file that was cut off (best effort: they never hold the only copy)
  if (fs.list) {
    const entries = await fs.list(dir || ".").catch(() => [] as string[]);
    for (const e of entries.filter((e) => isTmpOf(e, name))) await fs.remove(`${dir}${e}`).catch(() => {});
  }

  const tmp = `${dir}.${name}.${random()}${TMP_SUFFIX}`;
  try {
    await fs.write(tmp, bytes);
    if (fs.read) {
      const back = await fs.read(tmp);
      if (back.length !== bytes.length || back.some((b, i) => b !== bytes[i])) throw new Error(`${tmp}: the bytes on disk are not the ones written`);
    }
    await fs.rename(tmp, path);
  } catch (e) {
    await fs.remove(tmp).catch(() => {});
    throw e;
  }
}

/**
 * The desktop app's file system: the commands of module 0 (src-tauri/src/nova_files.rs),
 * which accept only a .nsd the user chose and its temporary files in the same folder.
 */
export function tauriFileOps(): FileOps {
  const invoke = async <T>(cmd: string, args: Record<string, unknown>) => (await import("@tauri-apps/api/core")).invoke<T>(cmd, args);
  return {
    write: (path, bytes) => invoke("nova_project_write", { path, bytes: Array.from(bytes) }),
    read: async (path) => Uint8Array.from(await invoke<number[]>("nova_project_read", { path })),
    rename: (from, to) => invoke("nova_project_rename", { from, to }),
    remove: (path) => invoke("nova_project_remove", { path }),
    list: (dir) => invoke("nova_project_list", { dir }),
  };
}
