// Module c, the cursor cross: one horizontal and one vertical line through the
// cursor, compared with the last point of the path being drawn. Zero tolerance at
// a tenth of a mm (the DST's resolution): the vertical arm turns «aligned» when
// round(x·10) = round(x_prev·10), the horizontal one when the same holds for y,
// each on its own. The pointer and the last point come from module 0's hook
// (onCanvasPointer), for Filum's tools and the registered ones (module m: m.7).

import { drawingCursor, type CanvasPointer, type LayerInfo } from "../core/registry";
import type { Vec2 } from "../../types";

/** A coordinate in mm as a whole number of tenths; the product is cleaned so 10,05 counts as 10,1. */
export const tenth = (mm: number): number => Math.round(Number((mm * 10).toFixed(6)));

export interface CrossArms {
  /** The vertical arm (same x to the tenth). */
  vertical: boolean;
  /** The horizontal arm (same y to the tenth). */
  horizontal: boolean;
}

export function crossArms(cursor: Vec2, prev: Vec2 | null): CrossArms {
  if (!prev) return { vertical: false, horizontal: false };
  return { vertical: tenth(cursor[0]) === tenth(prev[0]), horizontal: tenth(cursor[1]) === tenth(prev[1]) };
}

/** The cross for where the pointer is: hidden off the canvas and on a registered tool that refuses it (crosshair: false). */
export function crossFor(p: Pick<CanvasPointer, "tool" | "cursor" | "last">): CrossArms & { shown: boolean } {
  if (!p.cursor) return { vertical: false, horizontal: false, shown: false };
  const reg = drawingCursor(p.tool);
  return { ...crossArms(p.cursor, p.last), shown: !reg.registered || reg.crosshair };
}

/** The arms' colours: «normal» and «aligned» (green, told apart also by a thicker line). */
export const CROSS_COLORS = { normal: "rgba(120, 120, 140, 0.85)", aligned: "#16a34a" } as const;

/** Draws the cross on the canvas (crossCanvas): lines across the whole canvas through `cursor`, in mm. */
export function drawCross(ctx: CanvasRenderingContext2D, info: LayerInfo, cursor: Vec2, arms: CrossArms): void {
  const px = 1 / info.scale;
  const w = info.width ?? 0;
  const h = info.height ?? 0;
  // the canvas edges in mm
  const x0 = -info.ox / info.scale;
  const x1 = (w - info.ox) / info.scale;
  const y0 = -info.oy / info.scale;
  const y1 = (h - info.oy) / info.scale;
  const arm = (aligned: boolean, from: Vec2, to: Vec2) => {
    ctx.strokeStyle = aligned ? CROSS_COLORS.aligned : CROSS_COLORS.normal;
    ctx.lineWidth = (aligned ? 2 : 1) * px;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  };
  arm(arms.vertical, [cursor[0], y0], [cursor[0], y1]);
  arm(arms.horizontal, [x0, cursor[1]], [x1, cursor[1]]);
}
