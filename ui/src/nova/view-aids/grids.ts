// Module c, the target grid: axes through the hoop's centre and circles every
// target.spacing mm, without measures (Signor Poletti, 25/11), drawn in mm as a
// canvas layer. The plain
// grid is Filum's own, with its step from grid.step (Architect, 18/11).

import type { LayerInfo } from "../core/registry";
import type { Hoop, Vec2 } from "../../types";

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Fewer than this many CSS px between circles and they are not drawn (they would be a smudge). */
export const MIN_GAP_PX = 4;

const clean = (v: number) => Number(v.toFixed(6));

/** The target grid: the centre, and a circle every `spacing` mm out to the hoop's farthest corner. */
export function targetGrid(hoop: Pick<Hoop, "width" | "height">, spacing: number): { center: Vec2; circles: { r: number }[] } {
  const center: Vec2 = [hoop.width / 2, hoop.height / 2];
  const reach = Math.hypot(center[0], center[1]);
  const circles: { r: number }[] = [];
  if (spacing > 0) for (let i = 1; clean(i * spacing) <= reach + 1e-9; i++) circles.push({ r: clean(i * spacing) });
  return { center, circles };
}

/** The canvas edges in mm. */
export const visibleArea = (info: LayerInfo): Area => ({
  x0: -info.ox / info.scale,
  y0: -info.oy / info.scale,
  x1: ((info.width ?? 0) - info.ox) / info.scale,
  y1: ((info.height ?? 0) - info.oy) / info.scale,
});

const COLORS = {
  light: { target: "rgba(200, 30, 30, 0.45)", axis: "rgba(200, 30, 30, 0.75)" },
  dark: { target: "rgba(255, 110, 110, 0.45)", axis: "rgba(255, 110, 110, 0.8)" },
};

/** The target grid as a layer: the two axes across the canvas and the circles, no text. */
export function drawTarget(ctx: CanvasRenderingContext2D, info: LayerInfo, hoop: Pick<Hoop, "width" | "height">, spacing: number): void {
  if (info.mode === "realistic") return;
  const c = COLORS[info.dark ? "dark" : "light"];
  const px = 1 / info.scale;
  const a = visibleArea(info);
  const { center, circles } = targetGrid(hoop, spacing);
  ctx.lineWidth = px;
  ctx.strokeStyle = c.axis;
  ctx.beginPath();
  ctx.moveTo(center[0], a.y0);
  ctx.lineTo(center[0], a.y1);
  ctx.moveTo(a.x0, center[1]);
  ctx.lineTo(a.x1, center[1]);
  ctx.stroke();
  // circles closer than a few pixels are a smudge: none then
  if (spacing * info.scale < MIN_GAP_PX) return;
  ctx.strokeStyle = c.target;
  for (const { r } of circles) {
    ctx.beginPath();
    ctx.arc(center[0], center[1], r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
