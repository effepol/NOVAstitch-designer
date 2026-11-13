// Module b (Sequence list): the commands of the contract (section 3, «b — Lista
// sequenza»). Each one is a pure function of the document, run only through
// runCommand: one command = one undo step. The order of doc.objects stays the
// only source of the sewing order; no geometry and no stitch parameter changes.

import type { DesignObject, LockStyle, StitchDocument, Vec2 } from "../../types";
import { registerCommand, type Command } from "../core/commands";
import { currentMode } from "../core/mode";

export type Ties = "both" | "start" | "end" | "none";
export const TIES: Ties[] = ["both", "start", "end", "none"];

/** The ties an object has (absent = both, as in Filum). */
export const tiesOf = (o: DesignObject): Ties => o.ties ?? "both";
export const hasStartTie = (t: Ties) => t === "both" || t === "start";
export const hasEndTie = (t: Ties) => t === "both" || t === "end";
/** The ties with one end turned on or off. */
export function withTie(t: Ties, end: "start" | "end", on: boolean): Ties {
  const s = end === "start" ? on : hasStartTie(t);
  const e = end === "end" ? on : hasEndTie(t);
  return s && e ? "both" : s ? "start" : e ? "end" : "none";
}

/** Assisted: every object keeps the standard ties at both ends (b.6); the icons change nothing. */
const tiesLocked = () => currentMode() === "assisted";

/** The document with one object changed; the same document when the object is missing or nothing changes. */
function patchObject(doc: StitchDocument, id: string, fn: (o: DesignObject) => DesignObject): StitchDocument {
  const i = doc.objects.findIndex((o) => o.id === id);
  if (i < 0) return doc;
  const next = fn(doc.objects[i]);
  if (next === doc.objects[i]) return doc;
  const objects = doc.objects.slice();
  objects[i] = next;
  return { ...doc, objects };
}

/** An object without a field (the field disappears from the file). */
function without<K extends keyof DesignObject>(o: DesignObject, key: K): DesignObject {
  if (!(key in o)) return o;
  const { [key]: _, ...rest } = o;
  return rest as DesignObject;
}

type Lock = NonNullable<DesignObject["lock"]>;
/** The object's own lock for one end taken away: that end sews the machine's (standard) shape. */
function standardLock(o: DesignObject, end: "start" | "end"): DesignObject {
  const lock = o.lock;
  if (!lock) return o;
  const keys: (keyof Lock)[] = end === "start" ? ["start", "startScale", "startLength"] : ["end", "endScale", "endLength"];
  if (!keys.some((k) => k in lock)) return o;
  const rest: Lock = { ...lock };
  for (const k of keys) delete rest[k];
  return Object.keys(rest).length ? { ...o, lock: rest } : without(o, "lock");
}

// ---- the pure functions ----

/** Moves the objects `ids` (keeping their order) so that the first lands at `toIndex` among the others. */
export function reorder(doc: StitchDocument, p: { ids: string[]; toIndex: number }): StitchDocument {
  const ids = new Set(p.ids);
  const moving = doc.objects.filter((o) => ids.has(o.id));
  if (!moving.length) return doc;
  const rest = doc.objects.filter((o) => !ids.has(o.id));
  const at = Math.max(0, Math.min(rest.length, Math.round(p.toIndex)));
  const objects = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  return objects.every((o, i) => o === doc.objects[i]) ? doc : { ...doc, objects };
}

/** Turns the ties at the start and end on or off; a tie turned on is born standard (machine.lockStart / lockEnd). */
export function setTies(doc: StitchDocument, p: { id: string; ties: Ties }): StitchDocument {
  if (tiesLocked() || !TIES.includes(p.ties)) return doc;
  return patchObject(doc, p.id, (o) => {
    const was = tiesOf(o);
    if (was === p.ties) return o;
    let next = p.ties === "both" ? without(o, "ties") : { ...o, ties: p.ties };
    if (!hasStartTie(was) && hasStartTie(p.ties)) next = standardLock(next, "start");
    if (!hasEndTie(was) && hasEndTie(p.ties)) next = standardLock(next, "end");
    return next;
  });
}

/** The object's own lock shape at the start and/or end; null = the standard one (the machine's). */
export function setLock(doc: StitchDocument, p: { id: string; start?: LockStyle | null; end?: LockStyle | null }): StitchDocument {
  if (tiesLocked()) return doc;
  return patchObject(doc, p.id, (o) => {
    let next = o;
    for (const end of ["start", "end"] as const) {
      const v = p[end];
      if (v === undefined) continue;
      if (v === null) next = standardLock(next, end);
      else if (next.lock?.[end] !== v) next = { ...next, lock: { ...next.lock, [end]: v } };
    }
    return next;
  });
}

export function setTrimAfter(doc: StitchDocument, p: { id: string; value: boolean }): StitchDocument {
  return patchObject(doc, p.id, (o) => (o.trimAfter === !!p.value ? o : { ...o, trimAfter: !!p.value }));
}

export function setStopAfter(doc: StitchDocument, p: { id: string; value: boolean }): StitchDocument {
  return patchObject(doc, p.id, (o) => (o.stopAfter === !!p.value ? o : { ...o, stopAfter: !!p.value }));
}

const samePoint = (a: Vec2 | undefined, b: Vec2) => !!a && a[0] === b[0] && a[1] === b[1];
const isPoint = (v: unknown): v is Vec2 => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

function setPoint(doc: StitchDocument, id: string, key: "start" | "end", point: Vec2 | null): StitchDocument {
  return patchObject(doc, id, (o) => {
    if (point === null) return without(o, key);
    if (!isPoint(point) || samePoint(o[key], point)) return o;
    return { ...o, [key]: [point[0], point[1]] };
  });
}

/** Where the object starts sewing; null = automatic (the field disappears from the file). */
export const setStart = (doc: StitchDocument, p: { id: string; point: Vec2 | null }) => setPoint(doc, p.id, "start", p.point);
/** Where the object ends sewing; null = automatic. */
export const setEnd = (doc: StitchDocument, p: { id: string; point: Vec2 | null }) => setPoint(doc, p.id, "end", p.point);

// ---- registration ----

export const COMMANDS: Command<never>[] = [
  { id: "b.reorder", label: { it: "Cambia l'ordine di cucitura", en: "Change the sewing order" }, apply: reorder },
  { id: "b.setTies", label: { it: "Fermature", en: "Lock stitches" }, apply: setTies },
  { id: "b.setLock", label: { it: "Forma della fermatura", en: "Lock stitch shape" }, apply: setLock },
  { id: "b.setTrimAfter", label: { it: "Rasafilo dopo", en: "Trim after" }, apply: setTrimAfter },
  { id: "b.setStopAfter", label: { it: "Stop dopo", en: "Stop after" }, apply: setStopAfter },
  { id: "b.setStart", label: { it: "Partenza", en: "Start point" }, apply: setStart },
  { id: "b.setEnd", label: { it: "Arrivo", en: "End point" }, apply: setEnd },
] as unknown as Command<never>[];

/** Registers the commands of module b; returns the function that removes them. */
export function registerSequenceCommands(): () => void {
  const offs = COMMANDS.map((c) => registerCommand(c));
  return () => offs.forEach((off) => off());
}
