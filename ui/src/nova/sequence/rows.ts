// Module b: the rows of the sequence list. One row per object in sewing order
// (the order of doc.objects); the objects of one lettering that sew one after
// the other make one row. Stitch counts come from the plan.

import { FLAG, type DesignObject, type PlanData, type StitchDocument } from "../../types";
import { hasEndTie, hasStartTie, tiesOf } from "./commands";

export interface SequenceRow {
  /** The first object's id: stable while the row exists. */
  key: string;
  /** The objects of the row, in sewing order. */
  ids: string[];
  first: DesignObject;
  last: DesignObject;
  /** A lettering (one row for all its objects). */
  text: boolean;
  /** Tie at the start of the row (its first object) and at its end (its last object). */
  startTie: boolean;
  endTie: boolean;
  trimAfter: boolean;
  stopAfter: boolean;
  /** Own start / end point set (not automatic). */
  start: boolean;
  end: boolean;
}

export function sequenceRows(doc: StitchDocument): SequenceRow[] {
  const rows: SequenceRow[] = [];
  let cur: DesignObject[] = [];
  const close = () => {
    if (!cur.length) return;
    const first = cur[0];
    const last = cur[cur.length - 1];
    rows.push({
      key: first.id,
      ids: cur.map((o) => o.id),
      first,
      last,
      text: !!first.text,
      startTie: hasStartTie(tiesOf(first)),
      endTie: hasEndTie(tiesOf(last)),
      trimAfter: last.trimAfter,
      stopAfter: last.stopAfter,
      start: !!first.start,
      end: !!last.end,
    });
    cur = [];
  };
  for (const o of doc.objects) {
    const prev = cur[cur.length - 1];
    if (!prev || !o.text || prev.text?.group !== o.text.group) close();
    cur.push(o);
  }
  close();
  return rows;
}

/** Stitches per object id in a plan of `doc` (commands — jumps, trims, colour changes, stops, end — are not stitches). */
export function stitchesPerObject(doc: StitchDocument, plan: Pick<PlanData, "flags" | "objects">): Map<string, number> {
  const out = new Map<string, number>();
  const n = Math.min(plan.flags.length, plan.objects.length);
  for (let i = 0; i < n; i++) {
    if (plan.flags[i] & FLAG.COMMANDS) continue;
    const o = doc.objects[plan.objects[i]];
    if (o) out.set(o.id, (out.get(o.id) ?? 0) + 1);
  }
  return out;
}

/** The stitches of a row; undefined while no count is known for its objects. */
export function rowStitches(row: SequenceRow, counts: Map<string, number> | null): number | undefined {
  if (!counts) return undefined;
  let n = 0;
  let known = false;
  for (const id of row.ids) {
    const c = counts.get(id);
    if (c !== undefined) (n += c), (known = true);
  }
  return known ? n : 0;
}

/**
 * Dropping row `from` on row `over` (above or below it): where its objects go,
 * as the parameters of b.reorder; null when the order would not change.
 */
export function dropTarget(rows: SequenceRow[], from: string, over: string, at: "above" | "below"): { ids: string[]; toIndex: number } | null {
  const src = rows.find((r) => r.key === from);
  if (!src || from === over) return null;
  // the index among the objects without the moved ones
  let toIndex = 0;
  for (const r of rows) {
    if (r.key === from) continue;
    if (r.key === over) {
      if (at === "below") toIndex += r.ids.length;
      const all = rows.flatMap((x) => x.ids);
      const rest = all.filter((id) => !src.ids.includes(id));
      const next = [...rest.slice(0, toIndex), ...src.ids, ...rest.slice(toIndex)];
      return next.every((id, i) => id === all[i]) ? null : { ids: src.ids, toIndex };
    }
    toIndex += r.ids.length;
  }
  return null;
}
