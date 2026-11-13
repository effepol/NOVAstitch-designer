// The user's own hoops (module a): app data, not project data. One JSON file,
// user-hoops.json, in the app's config folder, with its schemaVersion, written
// in two steps (a temporary file, then renamed over the old one). Not undoable;
// deleting asks first. Every change emits userHoops.changed.
// Changing or deleting a hoop never touches a design: its sizes are in doc.hoop.

import type { HoopShape } from "../../types";
import type { PrefsStore } from "../core/prefs";
import { emit } from "../core/events";

export interface UserHoop {
  id: string;
  name: string;
  /** mm, as the hoop sits on the machine. */
  width: number;
  height: number;
  shape: HoopShape;
  /** A cap frame writes nova.hoopKind = "cap". */
  kind: "flat" | "cap";
}

declare module "../core/events" {
  interface NovaEvents {
    "userHoops.changed": { hoops: UserHoop[] };
  }
}

export const USER_HOOPS_FILE = "user-hoops.json";
export const USER_HOOPS_SCHEMA = 1;

export interface UserHoops {
  list(): UserHoop[];
  get(id: string): UserHoop | undefined;
  /** a.userHoops.add: returns the new hoop's id. */
  add(h: Omit<UserHoop, "id">): Promise<string>;
  /** a.userHoops.update */
  update(h: UserHoop): Promise<void>;
  /** a.userHoops.remove: only once `confirm` says yes; returns whether it did. */
  remove(id: string, confirm: () => Promise<boolean> | boolean): Promise<boolean>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const size = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;

/** A hoop that can be used: a name, two sizes above 0, a known shape and kind. */
export function validHoop(h: unknown): h is UserHoop {
  return (
    isObj(h) && typeof h.id === "string" && !!h.id && typeof h.name === "string" && !!h.name.trim() && size(h.width) && size(h.height) &&
    (h.shape === "rect" || h.shape === "oval") && (h.kind === "flat" || h.kind === "cap")
  );
}

const newId = (taken: Set<string>) => {
  let id: string;
  do id = `uh-${Math.random().toString(36).slice(2, 10)}`;
  while (taken.has(id));
  return id;
};

export async function openUserHoops(store: PrefsStore): Promise<UserHoops> {
  let hoops: UserHoop[] = [];
  try {
    const text = await store.read(USER_HOOPS_FILE);
    const parsed = text ? JSON.parse(text) : null;
    if (isObj(parsed) && Array.isArray(parsed.hoops)) hoops = parsed.hoops.filter(validHoop);
  } catch (e) {
    // damaged: an empty list; the file is replaced only at the next change
    console.error("nova: user-hoops.json unreadable", e);
  }

  const save = async (next: UserHoop[]) => {
    const tmp = `${USER_HOOPS_FILE}.tmp`;
    await store.write(tmp, `${JSON.stringify({ schemaVersion: USER_HOOPS_SCHEMA, hoops: next }, null, 2)}\n`);
    try {
      await store.rename(tmp, USER_HOOPS_FILE);
    } catch (e) {
      await store.remove?.(tmp).catch(() => {});
      throw e;
    }
    hoops = next;
    emit("userHoops.changed", { hoops: [...next] });
  };

  return {
    list: () => [...hoops],
    get: (id) => hoops.find((h) => h.id === id),
    async add(h) {
      const hoop = { ...h, id: newId(new Set(hoops.map((x) => x.id))) };
      if (!validHoop(hoop)) throw new Error(`not a usable hoop: ${JSON.stringify(h)}`);
      await save([...hoops, hoop]);
      return hoop.id;
    },
    async update(h) {
      if (!validHoop(h)) throw new Error(`not a usable hoop: ${JSON.stringify(h)}`);
      if (!hoops.some((x) => x.id === h.id)) throw new Error(`no hoop "${h.id}" in the list`);
      await save(hoops.map((x) => (x.id === h.id ? { ...h } : x)));
    },
    async remove(id, confirm) {
      if (!hoops.some((x) => x.id === id) || !(await confirm())) return false;
      await save(hoops.filter((x) => x.id !== id));
      return true;
    },
  };
}
