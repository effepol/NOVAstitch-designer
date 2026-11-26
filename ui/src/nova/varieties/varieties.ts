// Module n (varieties): the library of stitch varieties and the changes they
// make to an object. A variety is a pattern of the tatami rows or of the split
// satin stitches (contract, module n): lengths used in turn and shifts from
// row to row. The library is a folder, one JSON file per variety: those in the
// program (library/*.json) and the user's own (the folder «varieta/» in the
// app's data, desktop only). A file that is not valid is skipped, no error.
// «Normale» takes the fields away; «Casuale» and «Bisatin» are switches.
// Density, compensation and underlay are the preset's, never touched here.

import type { DesignObject, StitchDocument, StitchParams } from "../../types";

export type VarietyKind = "tatami" | "satin";

export interface Variety {
  id: string;
  name: { it: string; en: string };
  type: VarietyKind;
  /** The fields the variety writes (lengths in mm, shifts as shares 0..1). */
  values: Record<string, number[]>;
  user?: boolean;
}

// ---- provisional values: to check at the first stitch-out (Signor Poletti, 26/11)

/** Lungo-corto: 4.0 / 2.0 mm, shifts 0, ⅓, ⅔. PROVISIONAL: the files in library/ hold the same values. */
export const LONG_SHORT_LENGTHS = [4.0, 2.0];
export const LONG_SHORT_OFFSETS = [0, 0.333333, 0.666667];
/** Casuale: lengths 2.5–4.5 mm, shifts 0–1. PROVISIONAL. */
export const RANDOM_LENGTHS: [number, number] = [2.5, 4.5];
export const RANDOM_OFFSETS: [number, number] = [0, 1];

/** The fields of each kind (as in crates/core/src/model.rs). */
export const PATTERN_KEYS: Record<VarietyKind, [string, string]> = {
  tatami: ["lengthPattern", "offsetPattern"],
  satin: ["splitLengthPattern", "splitOffsetPattern"],
};
export const RANGE_KEYS: Record<VarietyKind, [string, string]> = {
  tatami: ["lengthRange", "offsetRange"],
  satin: ["splitLengthRange", "splitOffsetRange"],
};
export const SEED_KEY: Record<VarietyKind, string> = { tatami: "seed", satin: "randomSeed" };
export const BISATIN_KEY = "bisatin";

/** «Normale»: no variety (Filum's own stitches). */
export const NORMAL_ID = "normale";

/** The kind of variety a stitch takes: a tatami, a satin; none on a satin over foam (n.11) or other stitches. */
export function kindOf(st: StitchParams): VarietyKind | null {
  if (st.type === "fill") return (st.method ?? "tatami") === "tatami" && !st.gradient && !st.tartan ? "tatami" : null;
  if (st.type === "satin") return st.foam ? null : "satin";
  return null;
}

// ---- the library

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const text = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** A variety file, or null when it is not valid (skipped). */
export function parseVariety(json: string): Variety | null {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = o.name as Record<string, unknown> | undefined;
  if (typeof o.id !== "string" || !ID.test(o.id) || o.id === NORMAL_ID) return null;
  if (!name || typeof name !== "object" || !text(name.it) || !text(name.en)) return null;
  if (o.type !== "tatami" && o.type !== "satin") return null;
  const values = o.values as Record<string, unknown> | undefined;
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const [lengths, offsets] = PATTERN_KEYS[o.type];
  const keys = Object.keys(values);
  if (!keys.length || keys.some((k) => k !== lengths && k !== offsets)) return null;
  const nums = (x: unknown): x is number[] => Array.isArray(x) && x.length > 0 && x.length <= 64 && x.every((n) => typeof n === "number" && Number.isFinite(n));
  if (lengths in values && !(nums(values[lengths]) && values[lengths].every((n) => n >= 0.1 && n <= 50))) return null;
  if (offsets in values && !(nums(values[offsets]) && values[offsets].every((n) => n >= 0 && n <= 1))) return null;
  return { id: o.id, name: { it: name.it as string, en: name.en as string }, type: o.type, values: values as Record<string, number[]> };
}

/** The varieties of the program and of the user (file name → text); invalid files and repeated ids are skipped. */
export function loadVarieties(shipped: Record<string, string>, user: Record<string, string> = {}): Variety[] {
  const out: Variety[] = [];
  const add = (files: Record<string, string>, isUser: boolean) => {
    for (const name of Object.keys(files).sort()) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      const v = parseVariety(files[name]);
      if (!v) {
        console.warn(`nova: variety file skipped (not valid): ${name}`);
        continue;
      }
      if (out.some((x) => x.id === v.id)) continue;
      out.push(isUser ? { ...v, user: true } : v);
    }
  };
  add(shipped, false);
  add(user, true);
  return out;
}

let list: Variety[] = [];
const listeners = new Set<() => void>();
let version = 0;

export function setVarietyList(v: Variety[]): void {
  list = [...v];
  version++;
  for (const fn of [...listeners]) fn();
}
export const varietyList = (kind?: VarietyKind): Variety[] => (kind ? list.filter((v) => v.type === kind) : list);
export const varietyById = (id: string): Variety | undefined => list.find((v) => v.id === id);
export const varietyVersion = (): number => version;
export function onVarietyList(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A folder of the app's data: its file names and their text (null: no such folder). */
export interface FolderReader {
  list(dir: string): Promise<{ name: string; isDirectory: boolean }[] | null>;
  read(file: string): Promise<string>;
}

/** The user's folder in the app's data. */
export const USER_DIR = "varieta";

/** The user's variety files (file name → text); an unreadable folder or file is skipped. */
export async function userVarietyFiles(reader: FolderReader): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const entries = await reader.list(USER_DIR).catch(() => null);
  for (const e of entries ?? []) {
    if (e.isDirectory || !e.name.toLowerCase().endsWith(".json")) continue;
    try {
      out[e.name] = await reader.read(`${USER_DIR}/${e.name}`);
    } catch {
      // skipped
    }
  }
  return out;
}

// ---- what a choice changes

/** Fields to set (undefined: taken away). */
export type Patch = Record<string, unknown>;

/** The fields a variety writes: its own values, the rest of its kind's sequences taken away («Normale»: all of them). */
export function varietyPatch(kind: VarietyKind, v: Variety | null): Patch {
  const out: Patch = {};
  for (const k of PATTERN_KEYS[kind]) out[k] = v && v.type === kind && k in v.values ? [...v.values[k]] : undefined;
  return out;
}

/** «Casuale» on (with its ranges and seed) or off. */
export function randomPatch(kind: VarietyKind, on: boolean, lengths: [number, number] = RANDOM_LENGTHS, offsets: [number, number] = RANDOM_OFFSETS, seed?: number): Patch {
  const [lk, ok] = RANGE_KEYS[kind];
  const out: Patch = on ? { [lk]: [...lengths], [ok]: [...offsets] } : { [lk]: undefined, [ok]: undefined };
  if (on && seed !== undefined) out[SEED_KEY[kind]] = seed;
  return out;
}

export const bisatinPatch = (on: boolean): Patch => ({ [BISATIN_KEY]: on ? true : undefined });

/** The fields of module n a patch may touch on a stitch of this kind. */
function allowed(kind: VarietyKind): Set<string> {
  return new Set([...PATTERN_KEYS[kind], ...RANGE_KEYS[kind], SEED_KEY[kind], ...(kind === "satin" ? [BISATIN_KEY] : [])]);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The object with the patch applied and the fields recorded in nova.edited (so a fabric preset keeps them); the same object if nothing changes or it takes no variety. */
export function patchObject(o: DesignObject, patch: Patch): DesignObject {
  const kind = kindOf(o.stitch);
  if (!kind) return o;
  const ok = allowed(kind);
  const keys = Object.keys(patch).filter((k) => ok.has(k));
  const st = { ...(o.stitch as unknown as Record<string, unknown>) };
  const changed: string[] = [];
  for (const k of keys) {
    const v = patch[k];
    if (same(st[k], v)) continue;
    if (v === undefined) delete st[k];
    else st[k] = v;
    changed.push(k);
  }
  if (!changed.length) return o;
  const had = o.nova?.edited ?? [];
  const add = changed.map((k) => `stitch.${k}`).filter((n) => !had.includes(n));
  return { ...o, stitch: st as unknown as StitchParams, nova: { ...o.nova, edited: [...had, ...add] } };
}

export interface SetParams {
  ids: string[];
  patch: Patch;
}

/** The command's change: every listed object that takes a variety gets the patch (one undo step through runCommand). */
export function applyVariety(doc: StitchDocument, { ids, patch }: SetParams): StitchDocument {
  const want = new Set(ids);
  let touched = false;
  const objects = doc.objects.map((o) => {
    if (!want.has(o.id)) return o;
    const n = patchObject(o, patch);
    if (n !== o) touched = true;
    return n;
  });
  return touched ? { ...doc, objects } : doc;
}

/** The variety the stitch has: «Normale», a library id, or null (values of its own, not in the library). */
export function varietyInUse(st: StitchParams, kind: VarietyKind, all: Variety[] = varietyList(kind)): string | null {
  const s = st as unknown as Record<string, unknown>;
  const [lk, ok] = PATTERN_KEYS[kind];
  if (s[lk] === undefined && s[ok] === undefined) return NORMAL_ID;
  const hit = all.find((v) => v.type === kind && same(v.values[lk], s[lk]) && same(v.values[ok], s[ok]));
  return hit ? hit.id : null;
}

/** «Casuale» is on: both ranges set, or either. */
export const randomOn = (st: StitchParams, kind: VarietyKind): boolean => RANGE_KEYS[kind].some((k) => (st as unknown as Record<string, unknown>)[k] !== undefined);

/** A new seed, different from the old one (1..9973, as Filum's «new seed»). */
export const nextSeed = (old: number | undefined): number => ((old ?? 1) % 9973) + 1;
