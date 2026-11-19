// Module d — the needle path of a stitch plan: the lines the needle sews between
// two penetrations, in its thread's colour, and the penetrations. Only what the
// plan holds: no stitch is computed again. Jumps, trims, colour changes, stops
// and the end are not sewing lines: the line breaks there. The jumps the machine
// leaves uncut (plan.uncut) are kept apart, to be drawn dashed (Architect, 18/11).

import { FLAG, type PlanData } from "../../types";

export interface NeedleRun {
  /** Colour block (thread) index and its colour. */
  block: number;
  color: string;
  /** The penetrations it joins, x, y, … in mm (at least two). */
  pts: Float32Array;
  /** The plan record of each penetration. */
  rec: Uint32Array;
}

export interface UncutJumps {
  block: number;
  color: string;
  /** Segments x0, y0, x1, y1, … in mm: from where the needle is to where the jump lands. */
  segs: Float32Array;
  /** The plan record of each segment (the jump). */
  rec: Uint32Array;
}

export interface NeedlePath {
  runs: NeedleRun[];
  /** The uncut jumps, one entry per colour block that has any. */
  jumps: UncutJumps[];
  /** Every penetration drawn, x, y, … in mm, in sewing order, and its record. */
  dots: Float32Array;
  dotRec: Uint32Array;
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
  const uncut = plan.uncut?.mask;
  const runs: NeedleRun[] = [];
  const jumps: UncutJumps[] = [];
  const dots: number[] = [];
  const dotRec: number[] = [];
  let block = 0;
  const color = () => threads[block]?.color ?? "#222";
  let cur: number[] = [];
  let curRec: number[] = [];
  let segs: number[] = [];
  let segRec: number[] = [];
  const close = () => {
    if (cur.length >= 4) runs.push({ block, color: color(), pts: Float32Array.from(cur), rec: Uint32Array.from(curRec) });
    cur = [];
    curRec = [];
  };
  const closeJumps = () => {
    if (segs.length) jumps.push({ block, color: color(), segs: Float32Array.from(segs), rec: Uint32Array.from(segRec) });
    segs = [];
    segRec = [];
  };
  // where the needle is (any record moves it, drawn or not)
  let x = 0;
  let y = 0;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    const nx = coords[2 * i];
    const ny = coords[2 * i + 1];
    const px = x;
    const py = y;
    x = nx;
    y = ny;
    if (f & FLAG.COLOR_CHANGE) {
      close();
      closeJumps();
      block++;
      continue;
    }
    if (f & FLAG.JUMP) {
      close();
      if (uncut?.[i] && !hide?.[i] && (px !== nx || py !== ny)) {
        segs.push(px, py, nx, ny);
        segRec.push(i);
      }
      continue;
    }
    // no penetration, or one the view leaves out: the line breaks
    if (f & FLAG.COMMANDS || hide?.[i] || (!showUnderlay && f & FLAG.UNDERLAY)) {
      close();
      continue;
    }
    cur.push(nx, ny);
    curRec.push(i);
    dots.push(nx, ny);
    dotRec.push(i);
  }
  close();
  closeJumps();
  const out = { runs, jumps, dots: Float32Array.from(dots), dotRec: Uint32Array.from(dotRec) };
  if (!cache.has(plan)) cache.set(plan, new Map());
  cache.get(plan)!.set(showUnderlay, out);
  return out;
}
