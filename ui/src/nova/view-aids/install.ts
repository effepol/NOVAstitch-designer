// Module c (Grids, cursor cross, zoom) starts here: module 0 finds this file and
// calls install() once. Everything hangs on Filum through the registry and module
// 0's hooks for c (18/11): the target grid and the cross as canvas layers, the
// screen's calibration as the 1× zoom scale, the pointer and the last point drawn
// for the cross, buttons in the bottom bar (with their lesson anchors), items in
// the View menu. The plain grid is Filum's own, with its step from grid.step
// (Architect, 18/11). No command on the document: nothing here makes an undo step.

import {
  canvasLayers, onCanvasPointer, redrawCanvas, registerCanvasLayer, registerMenuItem, registerScreenScale, registerToolbarButton,
  setSystemCursorHidden, type CanvasPointer, type ToolbarButtonEntry,
} from "../core/registry";
import { openPrefs, prefs as appPrefs, type Prefs } from "../core/prefs";
import { isTauri } from "../../lib/platform";
import { useStore } from "../../store";
import type { Vec2 } from "../../types";
import { crossFor, drawCross } from "./cross";
import { showWindowCross } from "./crossWindow";
import { drawTarget } from "./grids";
import { calibratedScale } from "./zoom";
import { CURSOR_MODES, createViewAids, type CursorMode, type ViewAids } from "./settings";
import "./texts";

/** The grid steps the bar button goes round. */
export const GRID_STEPS = [1, 2, 5, 10];
const nextStep = (s: number) => GRID_STEPS.find((x) => x > s + 1e-9) ?? GRID_STEPS[0];
const nextMode = (m: CursorMode) => CURSOR_MODES[(CURSOR_MODES.indexOf(m) + 1) % CURSOR_MODES.length];
const stepLabel = (s: number) => (GRID_STEPS.includes(s) ? `c.grid.step.${s}` : "c.grid.step.other");

/** A point of the design (mm) on the window (CSS px): the canvas's place on screen and the view. */
function toClient(mm: Vec2): Vec2 | null {
  if (typeof document === "undefined") return null;
  const canvas = document.querySelector(".canvas-wrap canvas:last-of-type");
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  const v = useStore.getState().view;
  return [r.left + v.ox + mm[0] * v.scale, r.top + v.oy + mm[1] * v.scale];
}

let current: ViewAids | null = null;
/** The module's settings once it has started (the calibration window reads them). */
export const viewAids = (): ViewAids | null => current;

/** Registers module c on `aids`; returns the function that removes it all. */
export function installViewAids(aids: ViewAids): () => void {
  current = aids;
  const offs: (() => void)[] = [];
  const failed = (e: unknown) => useStore.getState().toast(String(e instanceof Error ? e.message : e), "error");

  // Filum's grid draws the plain grid, every grid.step mm
  const syncFilumGrid = () => useStore.getState().set({ gridStep: aids.gridStep() });
  syncFilumGrid();

  // zoom 1× = the screen's calibration (else the canvas keeps 96/25.4)
  offs.push(registerScreenScale({ id: "c.screen", module: "c", pxPerMm: () => calibratedScale(aids) }));

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
        const cross = crossFor({ tool: c.tool, cursor: c.mm, last: c.last });
        if (cross.shown) drawCross(ctx, info, c.mm, cross);
      },
    }),
  );

  // the pointer on the canvas and the last point drawn (module 0's hook)
  offs.push(onCanvasPointer((p: CanvasPointer) => aids.setCursor(p.cursor ? { tool: p.tool, mm: p.cursor, last: p.last, client: toClient(p.cursor) } : null)));
  // with a cross on, the system cursor hides over the canvas
  const hideSystemCursor = () => setSystemCursorHidden(aids.cursorMode() !== "normal");
  hideSystemCursor();

  // bar buttons: their text is read when they are registered, so a change registers them again
  const buttons = new Map<string, () => void>();
  const button = (entry: ToolbarButtonEntry | null, id: string) => {
    buttons.get(id)?.();
    buttons.delete(id);
    if (entry) buttons.set(id, registerToolbarButton(entry));
  };
  let wantedStep: number | null = null;
  let wantedMode: CursorMode | null = null;
  const stepButton = () =>
    button(
      {
        id: "c.gridStep",
        module: "c",
        order: 10,
        anchor: "c.gridStep",
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
      },
      "c.gridStep",
    );
  const targetButton = () =>
    button(
      { id: "c.target", module: "c", order: 11, anchor: "c.target", label: "c.target", title: "c.target.title", run: () => aids.showTarget(!aids.targetShown()), active: () => aids.targetShown() },
      "c.target",
    );
  const modeButton = () =>
    button(
      {
        id: "c.cursorMode",
        module: "c",
        order: 12,
        anchor: "c.cursorMode",
        label: `c.mode.button.${wantedMode ?? aids.cursorMode()}`,
        title: "c.mode.button.title",
        run: () => setMode(nextMode(wantedMode ?? aids.cursorMode())),
        active: () => (wantedMode ?? aids.cursorMode()) !== "normal",
      },
      "c.cursorMode",
    );
  const openCalibration = () => void import("./CalibrationDialog").then((m) => m.openCalibration(aids));
  // «non calibrato» beside the zoom while the screen is not calibrated: a click opens the calibration
  const calibrationNote = () =>
    button(
      aids.calibrated() ? null : { id: "c.uncalibrated", module: "c", order: -1, anchor: "c.uncalibrated", label: "c.zoom.uncalibrated", title: "c.zoom.uncalibrated.title", run: openCalibration },
      "c.uncalibrated",
    );
  const setMode = (m: CursorMode) => {
    wantedMode = m;
    modeButton();
    aids.set("cursor.mode", m).catch((e) => {
      wantedMode = null;
      modeButton();
      failed(e);
    });
  };
  calibrationNote();
  stepButton();
  targetButton();
  modeButton();
  offs.push(() => buttons.forEach((off) => off()));

  // View menu: the calibration and the three cursor modes
  offs.push(
    registerMenuItem({ id: "c.calibrate", module: "c", menu: "View", label: "c.calibrate", run: openCalibration }),
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
        hideSystemCursor();
        if (aids.cursorMode() !== "crossWindow") showWindowCross(null);
        redrawCanvas();
      } else if (what === "screen.pxPerMm") {
        calibrationNote();
      } else if (what === "target" || what === "target.spacing") {
        targetButton();
        redrawCanvas(true);
      } else if (what === "cursor") {
        const c = aids.cursor();
        if (aids.cursorMode() === "crossWindow") {
          const cross = c ? crossFor({ tool: c.tool, cursor: c.mm, last: c.last }) : null;
          showWindowCross(c && cross?.shown ? c.client : null, cross ?? undefined);
        } else if (aids.cursorMode() === "crossCanvas" && canvasLayers().some((l) => l.id === "c.cross")) redrawCanvas();
      }
    }),
  );

  return () => {
    offs.splice(0).forEach((off) => off());
    showWindowCross(null);
    setSystemCursorHidden(false);
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
