// Module b, part 2: the bar buttons «Start and end» and «Connections» and the
// two canvas layers they turn on, all through module 0's registry.

import { planOf, useStore } from "../../store";
import { registerCanvasLayer, registerToolbarButton, type ToolbarButtonEntry } from "../core/registry";
import { connections, drawConnections, drawMarks, startEndMarks } from "./overlay";
import { isOn, onViewOptions, toggleOption, type ViewOption } from "./view";

/** The plan of the document on screen (a stale plan of another document is not drawn). */
function current() {
  const { doc, plan } = useStore.getState();
  return { doc, plan: planOf.get(doc) ?? (plan && fits(plan.objects, doc.objects.length) ? plan : null) };
}

/** While the new plan is computed, the last one is drawn if its objects still exist. */
function fits(objects: Uint32Array, n: number): boolean {
  for (let i = 0; i < objects.length; i++) if (objects[i] >= n && objects[i] !== 0xffffffff) return false;
  return true;
}

const BUTTONS: { option: ViewOption; entry: Omit<ToolbarButtonEntry, "run" | "active"> }[] = [
  { option: "startEnd", entry: { id: "b.startEnd", module: "b", label: "b.view.startEnd", title: "b.view.startEnd.title", order: 10 } },
  { option: "links", entry: { id: "b.links", module: "b", label: "b.view.links", title: "b.view.links.title", order: 11 } },
];

/** Registers the buttons and the layers; returns the function that removes them. */
export function registerCanvasViews(): () => void {
  // a button is registered again when its option changes: the bar re-reads the registry and shows it on or off
  const offs = new Map<string, () => void>();
  const addButtons = () => {
    for (const { option, entry } of BUTTONS) {
      offs.get(entry.id)?.();
      offs.set(entry.id, registerToolbarButton({ ...entry, run: () => void toggleOption(option), active: () => isOn(option) }));
    }
  };
  addButtons();
  const offOptions = onViewOptions(addButtons);
  const offLinks = registerCanvasLayer({
    id: "b.links",
    module: "b",
    order: 10,
    draw: (ctx, info) => {
      if (!isOn("links")) return;
      const { doc, plan } = current();
      if (plan) drawConnections(ctx, connections(doc, plan), info.scale);
    },
  });
  const offMarks = registerCanvasLayer({
    id: "b.startEnd",
    module: "b",
    order: 11,
    draw: (ctx, info) => {
      if (!isOn("startEnd")) return;
      const { doc, plan } = current();
      drawMarks(ctx, startEndMarks(doc, plan), info.scale);
    },
  });
  return () => {
    offOptions();
    offLinks();
    offMarks();
    for (const off of offs.values()) off();
  };
}
