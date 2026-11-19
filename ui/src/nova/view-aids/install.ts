// Module c (Grids, cursor cross, zoom) starts here: module 0 finds this file and
// calls install() once. Everything hangs on Filum through the registry: the
// target grid and the cross as canvas layers, buttons in the bottom bar, items in
// the View menu. No command on the document: nothing here makes an undo step.
//
// The plain grid is Filum's own, with its step from grid.step; module c draws
// only the target grid and the cross (Architect, 18/11).
//
// Waiting for module 0's hooks (request of 18/11): the zoom buttons in the bar
// (ZoomButtons.tsx is ready for it), and the pointer on the canvas with the
// previous point of Filum's own tools for the cross (aids.setCursor, setTracePoint).

import { canvasLayers, redrawCanvas, registerCanvasLayer, registerMenuItem, registerToolbarButton, type ToolbarButtonEntry } from "../core/registry";
import { openPrefs, prefs as appPrefs, type Prefs } from "../core/prefs";
import { isTauri } from "../../lib/platform";
import { useStore } from "../../store";
import { crossFor, drawCross } from "./cross";
import { showWindowCross } from "./crossWindow";
import { drawTarget } from "./grids";
import { CURSOR_MODES, createViewAids, type CursorMode, type ViewAids } from "./settings";
import "./texts";

/** The grid steps the bar button goes round. */
export const GRID_STEPS = [1, 2, 5, 10];
const nextStep = (s: number) => GRID_STEPS.find((x) => x > s + 1e-9) ?? GRID_STEPS[0];
const nextMode = (m: CursorMode) => CURSOR_MODES[(CURSOR_MODES.indexOf(m) + 1) % CURSOR_MODES.length];
const stepLabel = (s: number) => (GRID_STEPS.includes(s) ? `c.grid.step.${s}` : "c.grid.step.other");

let current: ViewAids | null = null;
/** The module's settings once it has started (the zoom buttons and the calibration window read them). */
export const viewAids = (): ViewAids | null => current;

/** Registers module c on `aids`; returns the function that removes it all. */
export function installViewAids(aids: ViewAids): () => void {
  current = aids;
  const offs: (() => void)[] = [];
  const failed = (e: unknown) => useStore.getState().toast(String(e instanceof Error ? e.message : e), "error");

  // Filum's grid draws the plain grid, every grid.step mm
  const syncFilumGrid = () => useStore.getState().set({ gridStep: aids.gridStep() });
  syncFilumGrid();

  offs.push(
    registerCanvasLayer({
      id: "c.target",
      module: "c",
      z: "under",
      draw: (ctx, info) => aids.targetShown() && drawTarget(ctx, info, useStore.getState().doc.hoop, aids.targetSpacing()),
    }),
    registerCanvasLayer({
      id: "c.cross",
      module: "c",
      z: "over",
      draw: (ctx, info) => {
        const c = aids.cursor();
        if (!c || aids.cursorMode() !== "crossCanvas") return;
        const cross = crossFor(useStore.getState().tool, c.mm);
        if (cross.shown) drawCross(ctx, info, c.mm, cross);
      },
    }),
  );

  // bar buttons: their text is read when they are registered, so a change registers them again
  const buttons = new Map<string, () => void>();
  const button = (entry: ToolbarButtonEntry) => {
    buttons.get(entry.id)?.();
    buttons.set(entry.id, registerToolbarButton(entry));
  };
  let wantedStep: number | null = null;
  let wantedMode: CursorMode | null = null;
  const stepButton = () =>
    button({
      id: "c.gridStep",
      module: "c",
      order: 10,
      label: stepLabel(wantedStep ?? aids.gridStep()),
      title: "c.grid.step.title",
      run: () => {
        wantedStep = nextStep(wantedStep ?? aids.gridStep());
        aids.set("grid.step", wantedStep).catch((e) => {
          wantedStep = null;
          stepButton();
          failed(e);
        });
      },
    });
  const targetButton = () =>
    button({ id: "c.target", module: "c", order: 11, label: "c.target", title: "c.target.title", run: () => aids.showTarget(!aids.targetShown()), active: () => aids.targetShown() });
  const modeButton = () =>
    button({
      id: "c.cursorMode",
      module: "c",
      order: 12,
      label: `c.mode.button.${wantedMode ?? aids.cursorMode()}`,
      title: "c.mode.button.title",
      run: () => setMode(nextMode(wantedMode ?? aids.cursorMode())),
      active: () => (wantedMode ?? aids.cursorMode()) !== "normal",
    });
  const setMode = (m: CursorMode) => {
    wantedMode = m;
    modeButton();
    aids.set("cursor.mode", m).catch((e) => {
      wantedMode = null;
      modeButton();
      failed(e);
    });
  };
  stepButton();
  targetButton();
  modeButton();
  offs.push(() => buttons.forEach((off) => off()));

  // View menu: the calibration and the three cursor modes
  offs.push(
    registerMenuItem({
      id: "c.calibrate",
      module: "c",
      menu: "View",
      label: "c.calibrate",
      run: () => void import("./CalibrationDialog").then((m) => m.openCalibration(aids)),
    }),
    ...CURSOR_MODES.map((m, i) => registerMenuItem({ id: `c.mode.${m}`, module: "c", menu: "View", order: i + 1, label: `c.mode.${m}`, run: () => setMode(m), checked: () => (wantedMode ?? aids.cursorMode()) === m })),
  );

  offs.push(
    aids.onChange((what) => {
      if (what === "grid.step") {
        wantedStep = null;
        stepButton();
        syncFilumGrid();
        redrawCanvas(true);
      } else if (what === "cursor.mode") {
        wantedMode = null;
        modeButton();
        if (aids.cursorMode() !== "crossWindow") showWindowCross(null);
        redrawCanvas();
      } else if (what === "target" || what === "target.spacing") {
        targetButton();
        redrawCanvas(true);
      } else if (what === "cursor") {
        const c = aids.cursor();
        if (aids.cursorMode() === "crossWindow") {
          const cross = c ? crossFor(useStore.getState().tool, c.mm) : null;
          showWindowCross(c && cross?.shown ? c.client : null, cross ?? undefined);
        } else if (aids.cursorMode() === "crossCanvas" && canvasLayers().some((l) => l.id === "c.cross")) redrawCanvas();
      }
    }),
  );

  return () => {
    offs.splice(0).forEach((off) => off());
    showWindowCross(null);
    if (current === aids) current = null;
  };
}

/** The settings outside the desktop app (a page in a browser, the tests): in memory. */
const memoryPrefs = (): Promise<Prefs> => {
  const files = new Map<string, string>();
  return openPrefs({ read: async (n) => files.get(n) ?? null, write: async (n, x) => void files.set(n, x), rename: async (a, b) => void (files.set(b, files.get(a)!), files.delete(a)) });
};

export async function install(): Promise<void> {
  let p: Prefs;
  try {
    p = isTauri ? await appPrefs() : await memoryPrefs();
  } catch (e) {
    console.error("nova: module c settings not read", e);
    p = await memoryPrefs();
  }
  installViewAids(createViewAids(p));
}
