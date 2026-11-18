// Module m on the canvas: «Satin a due binari» and «Dividi e dirigi» as drawing
// tools of module 0's registry (they appear in Filum's tool rail). The tools
// only collect the clicks and draw the preview; the document changes through
// the commands m.satin.fromClicks and m.split.apply (one undo step each).
// Module c's cursor cross hooks onto them through lastPoint.

import { Columns2, Scissors } from "lucide-react";
import { activeThreadOf, useStore } from "../../store";
import type { PathNode, SubPath, Vec2 } from "../../types";
import { registerDrawingTool, type LayerInfo, type ToolPointerEvent } from "../core/registry";
import { runCommand } from "../core/commands";
import { currentMode } from "../core/mode";
import { t } from "../core/i18n";
import { draftStep, emptyDraft, previewOf, type TwoRailDraft } from "./twoRails";
import { planSplit, regionsOf, splitWarnings, type Line } from "./split";
import "./texts";

/** Colours of the preview: rail 1 blue, rail 2 orange, rungs grey, cut lines brown, direction lines red. */
export const COLORS = {
  rail1: "#1f6feb",
  rail2: "#f08c00",
  rung: "#8a8a8a",
  cut: "#8b4513",
  direction: "#d62828",
  edge: "#ffffff",
} as const;

const toast = (key: string, kind: "info" | "error" = "info") => useStore.getState().toast(t(key), kind);

/** Run a command and select what it added. */
function runAndSelect(id: string, params: unknown): void {
  const before = new Set(useStore.getState().doc.objects.map((o) => o.id));
  runCommand(id, params);
  const added = useStore.getState().doc.objects.filter((o) => !before.has(o.id)).map((o) => o.id);
  if (added.length) useStore.getState().select(added);
}

function strokePath(ctx: CanvasRenderingContext2D, sp: SubPath): void {
  const n = sp.nodes;
  if (n.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(n[0].p[0], n[0].p[1]);
  for (let k = 1; k < n.length; k++) {
    const a: PathNode = n[k - 1];
    const b: PathNode = n[k];
    if (a.o || b.i) {
      const c1 = a.o ?? a.p;
      const c2 = b.i ?? b.p;
      ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b.p[0], b.p[1]);
    } else ctx.lineTo(b.p[0], b.p[1]);
  }
  ctx.stroke();
}

function strokeLine(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, color: string, width: number, dash: number[] = []): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// «Satin a due binari» (Studio only)

let draft: TwoRailDraft = emptyDraft();
let hover: Vec2 | null = null;

function twoRailsPointer(e: ToolPointerEvent): void {
  if (e.kind === "move") {
    hover = e.p;
    return;
  }
  if (e.kind !== "down") return;
  draft = draftStep(draft, { type: "click", p: e.p, button: e.button === 2 ? "right" : "left" }).draft ?? emptyDraft();
}

function twoRailsKey(key: "Enter" | "Escape" | "Backspace"): boolean {
  if (key === "Backspace") {
    if (!draft.clicks.length) return false;
    draft = { clicks: draft.clicks.slice(0, -1) };
    return true;
  }
  if (key === "Escape") {
    if (!draft.clicks.length) return false;
    draft = emptyDraft();
    return true;
  }
  const r = draftStep(draft, { type: "enter" });
  draft = r.draft ?? emptyDraft();
  if (r.create) {
    const thread = activeThreadOf(useStore.getState()) ?? undefined;
    runAndSelect("m.satin.fromClicks", { ...r.create, ...(thread ? { thread } : {}) });
  }
  if (r.warning) toast(r.warning, r.create ? "info" : "error");
  return true;
}

function twoRailsPreview(ctx: CanvasRenderingContext2D, info: LayerInfo): void {
  const px = 1 / info.scale;
  const pv = previewOf(draft);
  const color = (c: "blue" | "orange") => (c === "blue" ? COLORS.rail1 : COLORS.rail2);
  for (const g of pv.rungs) strokeLine(ctx, g.a, g.b, COLORS.rung, 1.5 * px, [5 * px, 4 * px]);
  ctx.setLineDash([]);
  for (const r of pv.rails) {
    ctx.strokeStyle = color(r.color);
    ctx.lineWidth = 2 * px;
    strokePath(ctx, r.path);
  }
  // the next point's rail, from its previous point to the pointer
  const n = draft.clicks.length;
  if (hover && n >= 2) strokeLine(ctx, draft.clicks[n - 2].p, hover, n % 2 === 0 ? COLORS.rail1 : COLORS.rail2, 1 * px, [3 * px, 3 * px]);
  ctx.setLineDash([]);
  const half = 4 * px;
  for (const m of pv.points) {
    ctx.fillStyle = color(m.color);
    ctx.fillRect(m.p[0] - half, m.p[1] - half, 2 * half, 2 * half);
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = (m.curved ? 2 : 1) * px;
    ctx.strokeRect(m.p[0] - half, m.p[1] - half, 2 * half, 2 * half);
  }
}

// ---------------------------------------------------------------------------
// «Dividi e dirigi»

/** The lines drawn, in order: brown cuts and red directions. */
let lines: { line: Line; kind: "cut" | "direction" }[] = [];
let pending: { line: Line; kind: "cut" | "direction" } | null = null;
const of = (kind: "cut" | "direction") => lines.filter((l) => l.kind === kind).map((l) => l.line);

/** The selected shape the tool works on: an unlocked object with closed outlines. */
function target(): string | null {
  const s = useStore.getState();
  const o = s.doc.objects.find((x) => x.id === s.selection[0]);
  return o && !o.locked && !o.text && regionsOf(o).length ? o.id : null;
}

const resetSplit = () => {
  lines = [];
  pending = null;
};

function splitPointer(e: ToolPointerEvent): void {
  if (e.kind === "down") {
    if (!target()) return toast("m.split.selectShape", "error");
    // the right button draws a direction line, except in Assisted (there the direction is automatic)
    const kind = e.button === 2 ? "direction" : "cut";
    if (kind === "direction" && currentMode() === "assisted") return;
    pending = { line: [e.p, e.p], kind };
    return;
  }
  if (!pending) return;
  pending.line = [pending.line[0], e.p];
  if (e.kind !== "up") return;
  const [a, b] = pending.line;
  // a click without a drag adds no line
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) * e.scale >= 4) lines.push(pending);
  pending = null;
}

function splitKey(key: "Enter" | "Escape" | "Backspace"): boolean {
  if (key === "Escape") {
    if (!lines.length && !pending) return false;
    resetSplit();
    return true;
  }
  if (key === "Backspace") {
    if (!lines.length) return false;
    lines = lines.slice(0, -1);
    return true;
  }
  // Enter with nothing drawn changes nothing (a stray key does not convert the shape)
  if (!lines.length) return false;
  const id = target();
  if (!id) {
    toast("m.split.selectShape", "error");
    return true;
  }
  const params = { id, cuts: of("cut"), directions: currentMode() === "assisted" ? [] : of("direction") };
  const plan = planSplit(useStore.getState().doc, params);
  resetSplit();
  if (!plan) {
    toast("m.split.nothing", "error");
    return true;
  }
  runAndSelect("m.split.apply", params);
  for (const w of splitWarnings(plan, currentMode())) toast(w);
  return true;
}

function splitPreview(ctx: CanvasRenderingContext2D, info: LayerInfo): void {
  const px = 1 / info.scale;
  for (const l of [...lines, ...(pending ? [pending] : [])]) strokeLine(ctx, l.line[0], l.line[1], l.kind === "cut" ? COLORS.cut : COLORS.direction, 2.5 * px, l === pending ? [4 * px, 3 * px] : []);
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------

/** Registers both tools; returns the function that removes them. */
export function registerSatinTools(): () => void {
  const offs = [
    registerDrawingTool({
      id: "m.twoRails",
      module: "m",
      label: "m.tool.twoRails",
      icon: Columns2,
      order: 1,
      onPointer: twoRailsPointer,
      onKey: twoRailsKey,
      drawPreview: twoRailsPreview,
      onActivate: () => {
        draft = emptyDraft();
        hover = null;
        // the two-rail satin belongs to Studio
        if (currentMode() === "assisted") {
          toast("m.twoRails.studioOnly");
          useStore.getState().setTool("select");
        }
      },
      onDeactivate: () => {
        draft = emptyDraft();
        hover = null;
      },
      lastPoint: () => draft.clicks[draft.clicks.length - 1]?.p ?? null,
    }),
    registerDrawingTool({
      id: "m.split",
      module: "m",
      label: "m.tool.split",
      icon: Scissors,
      order: 2,
      onPointer: splitPointer,
      onKey: splitKey,
      drawPreview: splitPreview,
      onActivate: resetSplit,
      onDeactivate: resetSplit,
      lastPoint: () => pending?.line[0] ?? null,
    }),
  ];
  return () => offs.forEach((off) => off());
}
