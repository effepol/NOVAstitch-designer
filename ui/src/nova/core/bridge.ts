// Filum's own state changes, sent on the bus: doc.changed, selection.changed,
// view.changed, plan.ready. Installed once at start (main.tsx).

import { useStore } from "../../store";
import { emit } from "./events";
import { runningCommand } from "./commands";

/** Filum's 1× zoom: 96 CSS px per inch (BottomBar). Module c may calibrate it. */
export const FILUM_PX_PER_MM = 96 / 25.4;

let installed: (() => void) | null = null;

export function installBridge(): () => void {
  if (installed) return installed;
  const unsub = useStore.subscribe((s, prev) => {
    if (s.doc !== prev.doc) emit("doc.changed", { commandId: runningCommand()?.id ?? null });
    if (s.selection !== prev.selection) emit("selection.changed", { ids: s.selection });
    if (s.view !== prev.view || s.viewMode !== prev.viewMode)
      emit("view.changed", { mode: s.viewMode, scale: s.view.scale, ox: s.view.ox, oy: s.view.oy, zoomFactor: s.view.scale / FILUM_PX_PER_MM });
    if (s.plan && s.plan !== prev.plan) emit("plan.ready", { stats: s.plan.stats });
  });
  installed = () => {
    unsub();
    installed = null;
  };
  return installed;
}
