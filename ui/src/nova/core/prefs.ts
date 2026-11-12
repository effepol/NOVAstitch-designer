// App settings (contract, section 3): not undoable, never in the document.
// One JSON file in the app's config folder, with its schemaVersion, written in
// two steps (a temporary file, then renamed over the old one).

/** Where the file lives: the app's config folder (Tauri appConfigDir), or a folder in tests. */
export interface PrefsStore {
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove?(name: string): Promise<void>;
}

export interface Prefs {
  get<T = unknown>(key: string): T | undefined;
  /** Saved at once; throws (and keeps the old value) if the file cannot be written. */
  set(key: string, value: unknown): Promise<void>;
  /** Deletes only once `confirm` says yes; returns whether it did. */
  remove(key: string, confirm: () => Promise<boolean> | boolean): Promise<boolean>;
}

export const PREFS_FILE = "nova-prefs.json";
export const PREFS_SCHEMA = 1;

export async function openPrefs(store: PrefsStore): Promise<Prefs> {
  let values: Record<string, unknown> = {};
  try {
    const text = await store.read(PREFS_FILE);
    const parsed = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed.values === "object" && parsed.values) values = parsed.values;
  } catch (e) {
    // a damaged settings file: start from the defaults, the file is replaced at the next set
    console.error("nova: settings file unreadable", e);
  }

  const save = async (next: Record<string, unknown>) => {
    const tmp = `${PREFS_FILE}.tmp`;
    await store.write(tmp, JSON.stringify({ schemaVersion: PREFS_SCHEMA, values: next }, null, 2));
    try {
      await store.rename(tmp, PREFS_FILE);
    } catch (e) {
      await store.remove?.(tmp).catch(() => {});
      throw e;
    }
    values = next;
  };

  return {
    get: <T>(key: string) => values[key] as T | undefined,
    set: (key, value) => save({ ...values, [key]: value }),
    async remove(key, confirm) {
      if (!(key in values) || !(await confirm())) return false;
      const next = { ...values };
      delete next[key];
      await save(next);
      return true;
    },
  };
}

/** The app's config folder through Tauri (desktop). */
export function tauriPrefsStore(): PrefsStore {
  const fs = () => import("@tauri-apps/plugin-fs");
  return {
    async read(name) {
      const { exists, readTextFile, BaseDirectory } = await fs();
      return (await exists(name, { baseDir: BaseDirectory.AppConfig })) ? readTextFile(name, { baseDir: BaseDirectory.AppConfig }) : null;
    },
    async write(name, text) {
      const { mkdir, writeTextFile, BaseDirectory } = await fs();
      await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
      await writeTextFile(name, text, { baseDir: BaseDirectory.AppConfig });
    },
    async rename(from, to) {
      const { rename, BaseDirectory } = await fs();
      await rename(from, to, { oldPathBaseDir: BaseDirectory.AppConfig, newPathBaseDir: BaseDirectory.AppConfig });
    },
    async remove(name) {
      const { remove, BaseDirectory } = await fs();
      await remove(name, { baseDir: BaseDirectory.AppConfig });
    },
  };
}

let shared: Prefs | null = null;

/** The app's settings, opened once (desktop). */
export async function prefs(): Promise<Prefs> {
  return (shared ??= await openPrefs(tauriPrefsStore()));
}
