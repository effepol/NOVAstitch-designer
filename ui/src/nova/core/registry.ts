// Registries (contract, section 3, module 0): the modules hang their menu items,
// panels, canvas layers and bar buttons on Filum through these, without
// touching Filum's files. Texts are t() keys.

import { useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { Vec2 } from "../../types";

interface Entry {
  /** "<module>.<name>", unique in its registry. */
  id: string;
  /** The module that registers it (named in errors). */
  module: string;
  /** Lower first; equal orders keep the order of registration. */
  order?: number;
}

export interface MenuItemEntry extends Entry {
  /** A menu of Filum's bar ("File", "Edit", "Object", "Path", "Stitch", "Threads", "View", "Tools", "Help") or a new one. */
  menu: string;
  /** t() key of the label. */
  label: string;
  hint?: string;
  kbd?: string;
  run: () => void;
  checked?: () => boolean;
  disabled?: () => boolean;
}

/** A tab of the layers panel (beside Filum's Layers and Issues). */
export interface PanelEntry extends Entry {
  /** t() key of the tab's title. */
  title: string;
  render: () => ReactNode;
}

/** What a canvas layer draws with: the context is in mm (origin at the hoop's top-left, y down). */
export interface LayerInfo {
  scale: number;
  ox: number;
  oy: number;
  /** Canvas size in CSS px and device pixel ratio. */
  width?: number;
  height?: number;
  dpr?: number;
  mode?: string;
  dark?: boolean;
}

export interface CanvasLayerEntry extends Entry {
  /** Under the design (after Filum's grid and hoop) or over it (default). */
  z?: "under" | "over";
  draw: (ctx: CanvasRenderingContext2D, info: LayerInfo) => void;
}

/** A button of the bottom bar (beside the zoom buttons). */
export interface ToolbarButtonEntry extends Entry {
  /** t() key of the text, and of the tooltip. */
  label: string;
  title?: string;
  run: () => void;
  active?: () => boolean;
}

let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  for (const fn of [...listeners]) fn();
};

function registry<T extends Entry>(kind: string) {
  let seq = 0;
  const items = new Map<string, T & { seq: number }>();
  return {
    add(item: T): () => void {
      const had = items.get(item.id);
      if (had) throw new Error(`${kind} "${item.id}" from module "${item.module}": the id is already registered by module "${had.module}"`);
      const entry = { ...item, seq: seq++ };
      items.set(item.id, entry);
      changed();
      return () => {
        if (items.get(item.id) === entry) {
          items.delete(item.id);
          changed();
        }
      };
    },
    list: (): T[] => [...items.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.seq - b.seq),
  };
}

/** A pointer event on the canvas for a registered drawing tool: the point in mm, the button (0 left, 2 right). */
export interface ToolPointerEvent {
  kind: "down" | "move" | "up";
  p: Vec2;
  button: 0 | 2;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  /** Canvas px per mm: tolerances in pixels divide by it. */
  scale: number;
}

/** A drawing tool of a module, in Filum's tool rail (Architect, 18/11). Its id is "<module>.<name>". */
export interface DrawingToolEntry extends Entry {
  /** t() key of its name (the rail's tooltip). */
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** CSS cursor on the canvas (default: crosshair). */
  cursor?: string;
  /** Module c's cursor cross applies to this tool (default true). */
  crosshair?: boolean;
  /** Pointer events on the canvas, left and right button (the right one opens no menu). Middle button and Space still pan. */
  onPointer(e: ToolPointerEvent): void;
  /** Enter, Escape or Backspace while the tool is active; true = used (Filum does nothing with it). */
  onKey?(key: "Enter" | "Escape" | "Backspace"): boolean;
  /** What it is drawing, over the design, in mm (like a canvas layer). */
  drawPreview?(ctx: CanvasRenderingContext2D, info: LayerInfo): void;
  /** The tool was picked / left (another tool, or Esc in Filum): drop a half-drawn shape on leaving. */
  onActivate?(): void;
  onDeactivate?(): void;
  /** The last point placed, for module c's cross ("the previous point"); null when none. */
  lastPoint?(): Vec2 | null;
}

const menus = registry<MenuItemEntry>("Menu item");
const panelReg = registry<PanelEntry>("Panel");
const layers = registry<CanvasLayerEntry>("Canvas layer");
const buttons = registry<ToolbarButtonEntry>("Bar button");

export const registerMenuItem = menus.add;
export const registerPanel = panelReg.add;
export const registerCanvasLayer = layers.add;
export const registerToolbarButton = buttons.add;

export const menuItems = menus.list;
export const panels = panelReg.list;
export const canvasLayers = layers.list;
export const toolbarButtons = buttons.list;

const tools = registry<DrawingToolEntry>("Drawing tool");
/** Register a drawing tool; returns the function that removes it. */
export const registerDrawingTool = tools.add;
export const drawingTools = tools.list;
/** The registered tool with this id (undefined for Filum's own tools). */
export const drawingTool = (id: string): DrawingToolEntry | undefined => tools.list().find((x) => x.id === id);

let activeTool: string | null = null;

/** The canvas tells the registry which tool is picked: the old registered tool is left, the new one picked. */
export function activateDrawingTool(id: string): void {
  if (id === activeTool) return;
  const before = activeTool ? drawingTool(activeTool) : undefined;
  activeTool = id;
  try {
    before?.onDeactivate?.();
    drawingTool(id)?.onActivate?.();
  } catch (e) {
    console.error(`nova: drawing tool "${id}" failed to switch`, e);
  }
}

/** A pointer event for the tool `id`: true if it is a registered tool and got it. */
export function toolPointer(id: string, e: ToolPointerEvent): boolean {
  const tool = drawingTool(id);
  if (!tool) return false;
  try {
    tool.onPointer(e);
  } catch (err) {
    console.error(`nova: drawing tool "${id}" failed`, err);
  }
  return true;
}

/** A key for the tool `id`: true if it is a registered tool and used it. */
export function toolKey(id: string, key: "Enter" | "Escape" | "Backspace"): boolean {
  const tool = drawingTool(id);
  if (!tool?.onKey) return false;
  try {
    return tool.onKey(key);
  } catch (err) {
    console.error(`nova: drawing tool "${id}" failed`, err);
    return false;
  }
}

/**
 * Where module c hooks its cursor cross: for the tool `id`, whether it is a
 * registered drawing tool, whether it takes the cross, and the previous point.
 */
export function drawingCursor(id: string): { registered: boolean; crosshair: boolean; last: Vec2 | null } {
  const tool = drawingTool(id);
  if (!tool) return { registered: false, crosshair: false, last: null };
  let last: Vec2 | null = null;
  try {
    last = tool.lastPoint?.() ?? null;
  } catch {
    last = null;
  }
  return { registered: true, crosshair: tool.crosshair !== false, last };
}

/** Draw the registered layers of one level (the canvas calls this); a layer that fails is skipped.
 * Over the design, the active drawing tool's preview comes last. */
export function drawCanvasLayers(ctx: CanvasRenderingContext2D, info: LayerInfo, z: "under" | "over" = "over"): void {
  const tool = z === "over" && activeTool ? drawingTool(activeTool) : undefined;
  const all: { id: string; draw: (ctx: CanvasRenderingContext2D, info: LayerInfo) => void }[] = [
    ...layers.list().filter((l) => (l.z ?? "over") === z),
    ...(tool?.drawPreview ? [{ id: tool.id, draw: tool.drawPreview }] : []),
  ];
  for (const l of all) {
    ctx.save?.();
    try {
      l.draw(ctx, info);
    } catch (e) {
      console.error(`nova: canvas layer "${l.id}" failed`, e);
    } finally {
      ctx.restore?.();
    }
  }
}

const redraws = new Set<() => void>();
let layerVersion = 0;

/** Changes whenever the layers may draw differently: the canvas repaints what it keeps under the design. */
export const canvasLayersVersion = (): string => `${version}.${layerVersion}`;

/**
 * A layer's own state changed: the canvas paints again. `under`: a layer under
 * the design changed (grid step…), so the kept background is repainted too;
 * leave it false for layers over the design (a cursor cross), which cost nothing.
 */
export function redrawCanvas(under = false): void {
  if (under) layerVersion++;
  for (const fn of [...redraws]) fn();
}

/** The canvas listens: it paints again on a redraw request and when layers come or go. */
export function onCanvasRedraw(fn: () => void): () => void {
  redraws.add(fn);
  listeners.add(fn);
  return () => {
    redraws.delete(fn);
    listeners.delete(fn);
  };
}

/** React: re-render when something is registered or removed. */
export function useRegistry(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
