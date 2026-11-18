// Module b's tests: a small design A, B, C (running squares of 10 mm, one thread),
// placed so that the travel from one to another never crosses the third.

import type { DesignObject, StitchDocument } from "../../types";
import { emptyDoc } from "../../store";

/** Top-left corners of the squares, mm. */
export const AT: Record<string, [number, number]> = { A: [10, 10], B: [70, 10], C: [40, 60] };

export function square(id: string, extra: Partial<DesignObject> = {}): DesignObject {
  const [x, y] = AT[id] ?? [10, 10];
  const pts: [number, number][] = [
    [x, y],
    [x + 10, y],
    [x + 10, y + 10],
    [x, y + 10],
  ];
  return {
    id,
    name: id,
    thread: "t1",
    visible: true,
    locked: false,
    paths: [{ closed: true, nodes: pts.map((p) => ({ p })) }],
    stitch: { type: "running", length: 2.5, tolerance: 0.2, repeats: 1, beanRepeats: 0 },
    trimAfter: false,
    stopAfter: false,
    ...extra,
  };
}

/**
 * A, B, C in this order. `sewThrough`: the gaps between them are sewn through
 * (minJump), so only a trim asked for trims; otherwise the machine trims every gap.
 */
export function abc(sewThrough = true, objects: DesignObject[] = [square("A"), square("B"), square("C")]): StitchDocument {
  const d = emptyDoc();
  return {
    ...d,
    name: "Sequenza",
    threads: [{ id: "t1", name: "Rosso", color: "#cc0000", brand: "", code: "" }],
    objects: sewThrough ? objects.map((o) => ({ ...o, minJump: 1000 })) : objects,
  };
}
