// Module c, the cursor cross: one horizontal and one vertical line through the
// cursor, compared with the previous point of the path being drawn. Zero
// tolerance at a tenth of a mm (the DST's resolution): the vertical arm turns
// «aligned» when round(x·10) = round(x_prev·10), the horizontal one when the
// same holds for y, each on its own.

import { drawingCursor, type LayerInfo } from "../core/registry";
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

/**
 * The previous point of Filum's own tools (pen, lines…): module 0's hook gives
 * it (request of 18/11). Until it is in main, Filum's tools have none.
 */
let tracePoint: (() => Vec2 | null) | null = null;
export function setTracePoint(fn: (() => Vec2 | null) | null): void {
  tracePoint = fn;
}

/** The cross for the tool `toolId` with the cursor at `cursor` (mm): whether it is shown and how each arm is. */
export function crossFor(toolId: string, cursor: Vec2): CrossArms & { shown: boolean; prev: Vec2 | null } {
  const reg = drawingCursor(toolId);
  let prev: Vec2 | null = null;
  let shown = true;
  if (reg.registered) {
    shown = reg.crosshair;
    prev = reg.last;
  } else {
    try {
      prev = tracePoint?.() ?? null;
    } catch {
      prev = null;
    }
  }
  return { ...crossArms(cursor, prev), shown, prev };
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
