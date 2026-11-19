// Module d — draws the needle path in the stitch view. The context is in mm
// (as for a canvas layer: 1 mm = `scale` CSS px), so widths in pixels are
// divided by the scale: the line, the dashes and the dots keep their size at every zoom.

import type { PlanData } from "../../types";
import type { LayerInfo } from "../core/registry";
import { needlePath } from "./path";
import type { NeedlePathSettings } from "./settings";

/** Side of a dot in CSS px: always wider than the line, so it shows on it. */
export const dotPx = (widthPx: number) => Math.max(3, widthPx + 2);
/** An uncut jump: thin (never wider than the line, at most 1 px), dashes 4 px, gaps 3 px. */
export const jumpPx = (widthPx: number) => Math.min(widthPx, 1);
export const JUMP_DASH_PX = [4, 3];

export interface DrawOptions {
  showUnderlay?: boolean;
  /** The stitch-out player: only records before this one (default: all). */
  limit?: number;
}

/**
 * Draw the plan's needle path; false (and nothing drawn) when the option is off
 * or the view is not the stitch view: Filum's stitch view then stays as it is.
 */
export function drawNeedlePath(ctx: CanvasRenderingContext2D, plan: PlanData | null, info: LayerInfo, settings: NeedlePathSettings, opts: DrawOptions = {}): boolean {
  if (!settings.enabled || !plan || (info.mode !== undefined && info.mode !== "stitch")) return false;
  const { runs, jumps, dots, dotRec } = needlePath(plan, opts);
  const limit = opts.limit ?? Infinity;
  const scale = info.scale;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the uncut jumps first, under the sewing line
  if (jumps.length) {
    ctx.lineWidth = jumpPx(settings.widthPx) / scale;
    ctx.setLineDash(JUMP_DASH_PX.map((d) => d / scale));
    for (const j of jumps) {
      if (j.rec[0] >= limit) continue;
      ctx.strokeStyle = j.color;
      ctx.beginPath();
      for (let k = 0; k < j.rec.length && j.rec[k] < limit; k++) {
        ctx.moveTo(j.segs[4 * k], j.segs[4 * k + 1]);
        ctx.lineTo(j.segs[4 * k + 2], j.segs[4 * k + 3]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // the sewing line: one stroke per colour block
  ctx.lineWidth = settings.widthPx / scale;
  for (let k = 0; k < runs.length && runs[k].rec[0] < limit; ) {
    const block = runs[k].block;
    ctx.strokeStyle = runs[k].color;
    ctx.beginPath();
    for (; k < runs.length && runs[k].block === block && runs[k].rec[0] < limit; k++) {
      const { pts, rec } = runs[k];
      if (rec.length < 2 || rec[1] >= limit) continue;
      ctx.moveTo(pts[0], pts[1]);
      for (let j = 1; j < rec.length && rec[j] < limit; j++) ctx.lineTo(pts[2 * j], pts[2 * j + 1]);
    }
    ctx.stroke();
  }

  if (settings.dots && dots.length) {
    const s = dotPx(settings.widthPx) / scale;
    const h = s / 2;
    // what is on screen (mm); without a size, everything
    const x0 = info.width === undefined ? -Infinity : (0 - info.ox) / scale - h;
    const y0 = info.height === undefined ? -Infinity : (0 - info.oy) / scale - h;
    const x1 = info.width === undefined ? Infinity : (info.width - info.ox) / scale + h;
    const y1 = info.height === undefined ? Infinity : (info.height - info.oy) / scale + h;
    ctx.fillStyle = info.dark ? "rgba(255,255,255,.75)" : "rgba(0,0,0,.65)";
    for (let k = 0; k < dotRec.length && dotRec[k] < limit; k++) {
      const x = dots[2 * k];
      const y = dots[2 * k + 1];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      ctx.fillRect(x - h, y - h, s, s);
    }
  }
  ctx.restore();
  return true;
}
