// Module d — the needle path of a stitch plan: the lines the needle sews between
// two penetrations, in its thread's colour, and the penetrations. Only what the
// plan holds: no stitch is computed again. Jumps, trims, colour changes, stops
// and the end are not sewing lines: the line breaks there.

import { FLAG, type PlanData } from "../../types";

export interface NeedleRun {
  /** Colour block (thread) index and its colour. */
  block: number;
  color: string;
  /** The penetrations it joins, x, y, … in mm (at least two). */
  pts: Float32Array;
}

export interface NeedlePath {
  runs: NeedleRun[];
  /** Every penetration drawn, x, y, … in mm, in sewing order. */
  dots: Float32Array;
}

export interface NeedlePathOptions {
  /** Filum's «show underlay»: off, the underlay's stitches are left out (default on). */
  showUnderlay?: boolean;
}

const cache = new WeakMap<PlanData, Map<boolean, NeedlePath>>();

export function needlePath(plan: PlanData, opts: NeedlePathOptions = {}): NeedlePath {
  const showUnderlay = opts.showUnderlay !== false;
  const hit = cache.get(plan)?.get(showUnderlay);
  if (hit) return hit;
  const { coords, flags, threads } = plan;
  const hide = plan.hide;
  const runs: NeedleRun[] = [];
  const dots: number[] = [];
  let block = 0;
  let cur: number[] = [];
  const close = () => {
    if (cur.length >= 4) runs.push({ block, color: threads[block]?.color ?? "#222", pts: Float32Array.from(cur) });
    cur = [];
  };
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f & FLAG.COLOR_CHANGE) {
      close();
      block++;
      continue;
    }
    // no penetration, or one the view leaves out: the line breaks
    if (f & (FLAG.COMMANDS | FLAG.JUMP) || hide?.[i] || (!showUnderlay && f & FLAG.UNDERLAY)) {
      close();
      continue;
    }
    const x = coords[2 * i];
    const y = coords[2 * i + 1];
    cur.push(x, y);
    dots.push(x, y);
  }
  close();
  const out = { runs, dots: Float32Array.from(dots) };
  if (!cache.has(plan)) cache.set(plan, new Map());
  cache.get(plan)!.set(showUnderlay, out);
  return out;
}
