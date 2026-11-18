// Module d — draws the needle path in the stitch view. The context is in mm
// (as for a canvas layer: 1 mm = `scale` CSS px), so widths in pixels are
// divided by the scale: the line and the dots keep their size at every zoom.

import type { PlanData } from "../../types";
import type { LayerInfo } from "../core/registry";
import { needlePath } from "./path";
import type { NeedlePathSettings } from "./settings";

/** Side of a dot in CSS px: always wider than the line, so it shows on it. */
export const dotPx = (widthPx: number) => Math.max(3, widthPx + 2);

/**
 * Draw the plan's needle path; false (and nothing drawn) when the option is off
 * or the view is not the stitch view: Filum's stitch view then stays as it is.
 */
export function drawNeedlePath(
  ctx: CanvasRenderingContext2D,
  plan: PlanData | null,
  info: LayerInfo,
  settings: NeedlePathSettings,
  opts: { showUnderlay?: boolean } = {},
): boolean {
  if (!settings.enabled || !plan || (info.mode !== undefined && info.mode !== "stitch")) return false;
  const { runs, dots } = needlePath(plan, opts);
  const scale = info.scale;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = settings.widthPx / scale;
  // one stroke per colour block
  for (let k = 0; k < runs.length; ) {
    const block = runs[k].block;
    ctx.strokeStyle = runs[k].color;
    ctx.beginPath();
    for (; k < runs.length && runs[k].block === block; k++) {
      const p = runs[k].pts;
      ctx.moveTo(p[0], p[1]);
      for (let j = 2; j < p.length; j += 2) ctx.lineTo(p[j], p[j + 1]);
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
    for (let k = 0; k < dots.length; k += 2) {
      const x = dots[k];
      const y = dots[k + 1];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      ctx.fillRect(x - h, y - h, s, s);
    }
  }
  ctx.restore();
  return true;
}
