// Module b, part 2 — the click on a connection line (Architect's conditions, 19/11):
// the line under the pointer opens the menu only with «Connections» on, the selection
// tool, the left button and within the line's tolerance; otherwise Filum selects.

import { check, done } from "../core/testkit";
import { connectionAt, connections, HIT_PX, type Connection } from "./overlay";
import { abc, square } from "./fixture";
import { fullPlan } from "./dst";
import { useStore, planOf } from "../../store";
import { layerHit, layerClick } from "../core/registry";
import { setModeSource } from "../core/mode";
import { setLanguage } from "../core/i18n";
import { registerSequenceCommands } from "./commands";
import { registerCanvasViews } from "./canvas";
import { setOption } from "./view";
import { setMenuOpener } from "./menuHost";

const scale = 4; // px per mm
const on = { scale, linksOn: true, tool: "select", button: 0 };
const list: Connection[] = [
  { kind: "trim", from: [0, 0], to: [10, 0], objId: "A", manual: false },
  { kind: "join", from: [0, 5], to: [10, 5], objId: "B", manual: true },
  { kind: "trim", from: [20, 20], to: null, objId: "C", manual: false },
];
const tol = HIT_PX / scale;

check(connectionAt(list, [5, 0.2], on)?.objId === "A", "a click on the line finds it");
check(connectionAt(list, [5, tol * 0.9], on)?.objId === "A", "within the tolerance it still does");
check(connectionAt(list, [5, tol * 1.1], on) === null, "beyond the tolerance: no line (Filum selects)");
check(connectionAt(list, [5, 4.9], on)?.objId === "B", "the nearest line wins");
check(connectionAt(list, [20, 20], on) === null, "the design's last trim (no next object) opens no menu");
check(connectionAt(list, [5, 0], { ...on, linksOn: false }) === null, "«Connections» off: no line");
check(connectionAt(list, [5, 0], { ...on, tool: "pen" }) === null, "another tool than selection: no line");
check(connectionAt(list, [5, 0], { ...on, button: 2 }) === null, "the right button: no line");

// on a real plan: the middle of the connection A→B is found, and it belongs to A
{
  const d = abc(true, [square("A"), square("B", { trimAfter: true }), square("C")]);
  const lines = connections(d, fullPlan(d));
  const ab = lines.find((c) => c.objId === "A" && c.to)!;
  const mid: [number, number] = [(ab.from[0] + ab.to![0]) / 2, (ab.from[1] + ab.to![1]) / 2];
  check(connectionAt(lines, mid, on)?.objId === "A", "on the engine's plan the middle of A→B is A's connection");
}

// the whole way: a click from the canvas (module 0's layerClick) on the line A→B opens the
// menu at the click; a choice changes A, one undo step
(async () => {
  type Item = { label: string; checked?: boolean; run?: () => void; nova?: string };
  let opened: { items: Item[]; x: number; y: number } | null = null;
  setMenuOpener((items, x, y) => (opened = { items: items as Item[], x, y }));
  setLanguage("it");
  registerSequenceCommands();
  registerCanvasViews();
  setModeSource(() => "studio");
  const s = () => useStore.getState();
  s().setDoc(abc(false));
  planOf.set(s().doc, fullPlan(s().doc));
  const ab = connections(s().doc, fullPlan(s().doc)).find((c) => c.objId === "A" && c.to)!;
  const mid: [number, number] = [(ab.from[0] + ab.to![0]) / 2, (ab.from[1] + ab.to![1]) / 2];
  const view = { scale, ox: 0, oy: 0 };
  s().set({ tool: "select" });

  await setOption("links", false);
  check(layerHit(mid, view) === null, "«Collegamenti» off: the click stays Filum's selection");
  await setOption("links", true);
  check(layerHit(mid, view)?.id === "b.links", "«Collegamenti» on: a click on the line A→B goes to module b's layer");
  check(layerHit([mid[0], mid[1] + (HIT_PX / scale) * 3], view) === null, "away from the line: Filum's selection");
  s().set({ tool: "pen" });
  check(layerHit(mid, view) === null, "another tool: Filum's");
  s().set({ tool: "select" });

  const steps = s().past.length;
  check(layerClick(mid, view, 120, 80) && opened !== null, "the click opens the menu");
  const got = opened as unknown as { items: Item[]; x: number; y: number };
  check(got.x === 120 && got.y === 80, "at the click");
  check(got.items.map((i) => i.label).join(",") === "Rasafilo,Salto,Cucitura,Automatico" && got.items.every((i) => i.nova === "b"), "the same menu as the row: Rasafilo / Salto / Cucitura / Automatico, marked b");
  check(got.items.find((i) => i.checked)?.label === "Automatico", "the connection in force (the program's trim) is checked: Automatico");
  got.items.find((i) => i.label === "Cucitura")!.run!();
  const a = s().doc.objects.find((o) => o.id === "A")!;
  check(a.link === "join" && s().past.length === steps + 1, "Cucitura: A.link = \"join\" on the object that ends there, one undo step");
  s().undo();
  check(s().doc.objects.find((o) => o.id === "A")!.link === undefined, "one undo takes it away");

  setModeSource(() => "assisted");
  check(layerHit(mid, view) === null, "Assisted: no menu (the click is Filum's)");
  setModeSource(null);
  setMenuOpener(null);
  done("sequence connection click");
})();
