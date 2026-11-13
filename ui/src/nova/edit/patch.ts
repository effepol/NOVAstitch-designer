// Module f — Patch (contract, «f — Libreria e modifica», rules of the patch grid).
// rows × cols = all the pieces, the source included: it stays where it is as
// cell [0,0], top left. Every copy is an ordinary, independent object (never a
// linked clone); the PatchGroup in nova.patchGroups is only a record of which
// objects sit in which cell. Pure functions of the document: they run through
// runCommand (one command = one undo step).

import type { DesignObject, PatchGroup, StitchDocument, Vec2 } from "../../types";
import { objectBounds, translateMat, transformObject, uid, unionBoxes, type Box } from "../../lib/geometry";
import { freshCopies, placeCopies } from "../../lib/copies";
import { unlinkClone } from "../../lib/clones";

export type PatchOrder = PatchGroup["order"];
export type ColorGrouping = PatchGroup["colorGrouping"];

export interface PatchParams {
  sourceIds: string[];
  rows: number;
  cols: number;
  /** Gap between the edges of neighbouring pieces (mm). */
  gap: Vec2;
  order: PatchOrder;
  colorGrouping: ColorGrouping;
}

/** More pieces than this are refused (the machine could not sew them in one hoop anyway). */
export const MAX_PIECES = 400;

export const ORDERS: PatchOrder[] = ["rows", "serpentine"];
export const GROUPINGS: ColorGrouping[] = ["byColor", "byCopy"];

export const patchGroups = (doc: StitchDocument): PatchGroup[] => doc.nova?.patchGroups ?? [];
export const findGroup = (doc: StitchDocument, id: string) => patchGroups(doc).find((g) => g.id === id);

/** The group an object belongs to, if any. */
export const groupOf = (doc: StitchDocument, objectId: string) => patchGroups(doc).find((g) => g.cells.some((c) => c.objectIds.includes(objectId)));

const boxOf = (objs: DesignObject[]): Box | null => unionBoxes(objs.map(objectBounds));
const centreOf = (o: DesignObject): Vec2 | null => {
  const b = objectBounds(o);
  return b ? [b.x + b.w / 2, b.y + b.h / 2] : null;
};
const whole = (n: unknown, lo: number, hi: number) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;
const finite = (v: unknown): v is Vec2 => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

function withGroups(doc: StitchDocument, groups: PatchGroup[]): StitchDocument {
  return { ...doc, nova: { schemaVersion: 1, ...doc.nova, patchGroups: groups } };
}

/** The cells in the order they are sewn: row by row; serpentine turns back on the odd rows. */
export function cellsInOrder(g: Pick<PatchGroup, "cells" | "order">): PatchGroup["cells"] {
  return [...g.cells].sort((a, b) => a.row - b.row || (g.order === "serpentine" && a.row % 2 ? b.col - a.col : a.col - b.col));
}

/**
 * The objects of the group in the order they are sewn. byCopy: one piece after
 * the other. byColor: one colour block after the other (colours in the order
 * they first come), each block through the pieces in the chosen order. The
 * colours are the ones the objects have now.
 */
export function sewingSequence(doc: StitchDocument, g: PatchGroup, mode: ColorGrouping = g.colorGrouping): DesignObject[] {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const pieces = cellsInOrder(g).map((c) => c.objectIds.map((id) => byId.get(id)).filter((o): o is DesignObject => !!o));
  if (mode === "byCopy") return pieces.flat();
  const colours: string[] = [];
  for (const o of pieces.flat()) if (!colours.includes(o.thread)) colours.push(o.thread);
  return colours.flatMap((t) => pieces.flatMap((p) => p.filter((o) => o.thread === t)));
}

/** Colour changes inside the group, sewn with `mode`. */
export function colorChanges(doc: StitchDocument, groupId: string, mode?: ColorGrouping): number {
  const g = findGroup(doc, groupId);
  if (!g) return 0;
  const seq = sewingSequence(doc, g, mode);
  return seq.reduce((n, o, i) => n + (i > 0 && o.thread !== seq[i - 1].thread ? 1 : 0), 0);
}

/** The footprint of the group: the box of all its objects (null when none is left). */
export function footprint(doc: StitchDocument, g: PatchGroup): Box | null {
  const ids = new Set(g.cells.flatMap((c) => c.objectIds));
  return boxOf(doc.objects.filter((o) => ids.has(o.id)));
}

/** How far the group reaches beyond the hoop, in x and in y (mm, both sides added). */
export function overflow(doc: StitchDocument, groupId: string): Vec2 {
  const g = findGroup(doc, groupId);
  const b = g && footprint(doc, g);
  if (!b) return [0, 0];
  const out = (lo: number, size: number, max: number) => Math.max(0, -lo) + Math.max(0, lo + size - max);
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return [r(out(b.x, b.w, doc.hoop.width)), r(out(b.y, b.h, doc.hoop.height))];
}

/**
 * The group brought up to date and its objects put in its sewing order, as
 * one block where its first object was. Ids of deleted objects are dropped
 * (a group with nothing left goes); an object that belongs to no group, is
 * sewn after the group's first object and has its centre inside the group's
 * footprint joins the cell that holds its centre. Returns the same document
 * when nothing changes.
 */
export function regroup(doc: StitchDocument, groupId: string, change: Partial<Pick<PatchGroup, "order" | "colorGrouping">> = {}, adopt = true): StitchDocument {
  const groups = patchGroups(doc);
  const gi = groups.findIndex((g) => g.id === groupId);
  if (gi < 0) return doc;
  const alive = new Set(doc.objects.map((o) => o.id));
  let g: PatchGroup = { ...groups[gi], ...change, cells: groups[gi].cells.map((c) => ({ ...c, objectIds: c.objectIds.filter((id) => alive.has(id)) })) };
  let members = new Set(g.cells.flatMap((c) => c.objectIds));
  if (!members.size) return withGroups(doc, groups.filter((_, i) => i !== gi));

  // objects added later: into the cell of their centre
  const box = footprint(doc, g);
  const first = doc.objects.findIndex((o) => members.has(o.id));
  const taken = new Set(groups.flatMap((x) => x.cells.flatMap((c) => c.objectIds)));
  if (adopt && box && box.w > 0 && box.h > 0)
    for (const o of doc.objects.slice(first + 1)) {
      if (taken.has(o.id)) continue;
      const p = centreOf(o);
      if (!p || p[0] < box.x || p[1] < box.y || p[0] > box.x + box.w || p[1] > box.y + box.h) continue;
      const col = Math.min(g.cols - 1, Math.floor(((p[0] - box.x) / box.w) * g.cols));
      const row = Math.min(g.rows - 1, Math.floor(((p[1] - box.y) / box.h) * g.rows));
      g = { ...g, cells: g.cells.map((c) => (c.row === row && c.col === col ? { ...c, objectIds: [...c.objectIds, o.id] } : c)) };
    }
  members = new Set(g.cells.flatMap((c) => c.objectIds));

  const seq = sewingSequence(doc, g);
  const rest = doc.objects.filter((o) => !members.has(o.id));
  const objects = [...rest.slice(0, first), ...seq, ...rest.slice(first)];
  const sameObjects = objects.length === doc.objects.length && objects.every((o, i) => o === doc.objects[i]);
  const sameGroup = JSON.stringify(g) === JSON.stringify(groups[gi]);
  if (sameObjects && sameGroup) return doc;
  const next = sameGroup ? groups : groups.map((x, i) => (i === gi ? g : x));
  return withGroups(sameObjects ? doc : { ...doc, objects }, next);
}

/** f.patch.create: the copies and their PatchGroup; the same document when the request cannot be done. */
export function createPatch(doc: StitchDocument, p: PatchParams): StitchDocument {
  if (!p || !whole(p.rows, 1, MAX_PIECES) || !whole(p.cols, 1, MAX_PIECES) || p.rows * p.cols < 2 || p.rows * p.cols > MAX_PIECES) return doc;
  if (!finite(p.gap) || !ORDERS.includes(p.order) || !GROUPINGS.includes(p.colorGrouping)) return doc;
  const ids = new Set(p.sourceIds ?? []);
  // in the sewing order they have now
  const sources = doc.objects.filter((o) => ids.has(o.id));
  if (!sources.length || sources.some((o) => groupOf(doc, o.id))) return doc;
  const box = boxOf(sources);
  if (!box) return doc;
  const [px, py] = [box.w + p.gap[0], box.h + p.gap[1]];

  const copies: DesignObject[] = [];
  const parents: Record<string, string> = {};
  const names: Record<string, string> = {};
  const cells: PatchGroup["cells"] = [];
  for (let row = 0; row < p.rows; row++)
    for (let col = 0; col < p.cols; col++) {
      if (!row && !col) {
        cells.push({ row, col, objectIds: sources.map((o) => o.id) });
        continue;
      }
      // copies of their own: new ids, new groups and letterings; a linked clone becomes a plain object
      const fresh = freshCopies(doc, sources);
      const placed = placeCopies(fresh.objects, translateMat(col * px, row * py)).map((c) => {
        const plain = c.clone ? unlinkClone(c) : c;
        return { ...plain, name: `${plain.name} ${row + 1}.${col + 1}` };
      });
      Object.assign(parents, fresh.parents);
      Object.assign(names, fresh.names);
      copies.push(...placed);
      cells.push({ row, col, objectIds: placed.map((c) => c.id) });
    }

  const group: PatchGroup = { id: uid("patch"), sourceIds: sources.map((o) => o.id), rows: p.rows, cols: p.cols, gap: [p.gap[0], p.gap[1]], order: p.order, colorGrouping: p.colorGrouping, cells };
  const added: StitchDocument = {
    ...doc,
    objects: [...doc.objects, ...copies],
    ...(Object.keys(parents).length ? { groupParents: { ...doc.groupParents, ...parents } } : {}),
    ...(Object.keys(names).length ? { groupNames: { ...doc.groupNames, ...names } } : {}),
  };
  // at birth the cells hold exactly the source and its copies
  return regroup(withGroups(added, [...patchGroups(doc), group]), group.id, {}, false);
}

export const setOrder = (doc: StitchDocument, p: { groupId: string; order: PatchOrder }): StitchDocument =>
  ORDERS.includes(p?.order) ? regroup(doc, p.groupId, { order: p.order }) : doc;

export const setColorGrouping = (doc: StitchDocument, p: { groupId: string; mode: ColorGrouping }): StitchDocument =>
  GROUPINGS.includes(p?.mode) ? regroup(doc, p.groupId, { colorGrouping: p.mode }) : doc;

/** f.patch.center: the whole grid moved so that its footprint sits in the middle of the hoop. */
export function centerPatch(doc: StitchDocument, p: { groupId: string }): StitchDocument {
  const g = findGroup(doc, p?.groupId);
  const b = g && footprint(doc, g);
  if (!g || !b) return doc;
  const dx = doc.hoop.width / 2 - (b.x + b.w / 2);
  const dy = doc.hoop.height / 2 - (b.y + b.h / 2);
  const moved = Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9;
  const ids = new Set(g.cells.flatMap((c) => c.objectIds));
  const m = translateMat(dx, dy);
  const next = moved ? { ...doc, objects: doc.objects.map((o) => (ids.has(o.id) ? transformObject(o, m) : o)) } : doc;
  return regroup(next, g.id);
}
