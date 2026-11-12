// Registries (contract, section 3, module 0): the modules hang their menu items,
// panels, canvas layers and bar buttons on Filum through these, without
// touching Filum's files. Texts are t() keys.

import { useSyncExternalStore, type ReactNode } from "react";

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

/** Draw the registered layers of one level (the canvas calls this); a layer that fails is skipped. */
export function drawCanvasLayers(ctx: CanvasRenderingContext2D, info: LayerInfo, z: "under" | "over" = "over"): void {
  for (const l of layers.list()) {
    if ((l.z ?? "over") !== z) continue;
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
