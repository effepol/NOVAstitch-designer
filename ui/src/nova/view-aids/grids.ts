// Module c, grids: the plain grid every grid.step mm and the target grid (axes
// through the hoop's centre, circles every target.spacing mm with their measure).
// Both are anchored to the hoop's centre and drawn in mm (canvas layers).

import type { LayerInfo } from "../core/registry";
import type { Hoop, Vec2 } from "../../types";

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Fewer than this many CSS px between lines and the grid is not drawn (it would be a grey wash). */
export const MIN_GAP_PX = 4;

const clean = (v: number) => Number(v.toFixed(6));

/** The grid's lines inside `area` (mm), every `step` mm, through the hoop's centre. */
export function gridLines(hoop: Pick<Hoop, "width" | "height">, step: number, area: Area): { xs: number[]; ys: number[] } {
  if (!(step > 0)) return { xs: [], ys: [] };
  const along = (c: number, a: number, b: number) => {
    const out: number[] = [];
    for (let i = Math.ceil(clean((a - c) / step)); clean(c + i * step) <= b; i++) out.push(clean(c + i * step));
    return out;
  };
  return { xs: along(hoop.width / 2, area.x0, area.x1), ys: along(hoop.height / 2, area.y0, area.y1) };
}

/** The target grid: the centre, and a circle every `spacing` mm out to the hoop's farthest corner. */
export function targetGrid(hoop: Pick<Hoop, "width" | "height">, spacing: number): { center: Vec2; circles: { r: number; label: string }[] } {
  const center: Vec2 = [hoop.width / 2, hoop.height / 2];
  const reach = Math.hypot(center[0], center[1]);
  const circles: { r: number; label: string }[] = [];
  if (spacing > 0) for (let i = 1; clean(i * spacing) <= reach + 1e-9; i++) circles.push({ r: clean(i * spacing), label: String(clean(i * spacing)) });
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
  light: { grid: "rgba(0, 0, 0, 0.10)", target: "rgba(200, 30, 30, 0.45)", axis: "rgba(200, 30, 30, 0.75)", text: "rgba(160, 20, 20, 0.9)" },
  dark: { grid: "rgba(255, 255, 255, 0.10)", target: "rgba(255, 110, 110, 0.45)", axis: "rgba(255, 110, 110, 0.8)", text: "rgba(255, 150, 150, 0.95)" },
};

/** The plain grid as a layer (module 0's hook decides whether it replaces Filum's own). */
export function drawGrid(ctx: CanvasRenderingContext2D, info: LayerInfo, hoop: Pick<Hoop, "width" | "height">, step: number): void {
  if (info.mode === "realistic" || step * info.scale < MIN_GAP_PX) return;
  const a = visibleArea(info);
  const { xs, ys } = gridLines(hoop, step, a);
  ctx.strokeStyle = (info.dark ? COLORS.dark : COLORS.light).grid;
  ctx.lineWidth = 1 / info.scale;
  ctx.beginPath();
  for (const x of xs) {
    ctx.moveTo(x, a.y0);
    ctx.lineTo(x, a.y1);
  }
  for (const y of ys) {
    ctx.moveTo(a.x0, y);
    ctx.lineTo(a.x1, y);
  }
  ctx.stroke();
}

/** The target grid as a layer: the two axes across the canvas, the circles, each measure at the top of its circle. */
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
  ctx.fillStyle = c.text;
  ctx.font = `${11 * px}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  for (const { r, label } of circles) ctx.fillText(label, center[0] + 2 * px, center[1] - r - px);
}
