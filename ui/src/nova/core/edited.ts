// The record of manual edits (contract, section 3, module 0): every change to
// an object's stitch or lock parameters that does not come from a command
// marked system adds the parameter's name to that object's nova.edited.
// Studio only: in Assisted nothing is recorded (what Studio recorded stays).

import type { DesignObject, StitchDocument } from "../../types";
import { currentMode } from "./mode";
import { runningCommand } from "./running";

/** The object's own lock parameters ("parametri di fermatura"). */
export const LOCK_PARAMS = ["ties", "lock", "forceLock"] as const;

/** Coordinates, not parameters (decision 4, 12/11): moving the shape changes them, nothing is recorded. */
const COORDINATES = new Set(["guides", "center", "guide", "flow", "from", "to", "target", "anchor", "origin", "mesh", "points"]);

/** Equal once the coordinates are left out (at any depth). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((v, i) => same(v, (b as unknown[])[i]));
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const k of keys) if (!COORDINATES.has(k) && !same(ra[k], rb[k])) return false;
  return true;
}

/** The parameter names that differ between two versions of an object. */
export function changedParams(before: DesignObject, after: DesignObject): string[] {
  const out: string[] = [];
  if (before.stitch !== after.stitch) {
    const a = before.stitch as unknown as Record<string, unknown>;
    const b = after.stitch as unknown as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!COORDINATES.has(k) && !same(a[k], b[k])) out.push(`stitch.${k}`);
  }
  for (const k of LOCK_PARAMS) if (!same(before[k], after[k])) out.push(k);
  return out;
}

/** `next` with the manual edits made since `prev` recorded; the same object when there is nothing to record. */
export function recordEdits(prev: StitchDocument, next: StitchDocument): StitchDocument {
  if (next.objects === prev.objects || runningCommand()?.system || currentMode() !== "studio") return next;
  const before = new Map(prev.objects.map((o) => [o.id, o]));
  let touched = false;
  const objects = next.objects.map((o) => {
    const p = before.get(o.id);
    if (!p || p === o) return o;
    const names = changedParams(p, o);
    const had = o.nova?.edited ?? [];
    const add = names.filter((n) => !had.includes(n));
    if (!add.length) return o;
    touched = true;
    return { ...o, nova: { ...o.nova, edited: [...had, ...add] } };
  });
  return touched ? { ...next, objects } : next;
}
