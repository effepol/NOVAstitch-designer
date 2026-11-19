// Module b, part 2 — the click on a connection line (Architect's conditions, 19/11):
// the line under the pointer opens the menu only with «Connections» on, the selection
// tool, the left button and within the line's tolerance; otherwise Filum selects.

import { check, done } from "../core/testkit";
import { connectionAt, connections, HIT_PX, type Connection } from "./overlay";
import { abc, square } from "./fixture";
import { fullPlan } from "./dst";

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

done("sequence connection click");
