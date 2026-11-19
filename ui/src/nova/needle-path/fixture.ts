// Module d's tests: a design of more than 1,000 stitches planned by Filum's
// engine (the WebAssembly build, as the app runs it), and small hand-made plans.

import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm.js";
import { emptyDoc } from "../../store";
import { FLAG, type DesignObject, type PlanData, type StitchDocument } from "../../types";

let engine: StitchEngine | null = null;
function eng(): StitchEngine {
  if (!engine) {
    initSync({ module: readFileSync(path.resolve(process.cwd(), "src/wasm/pkg/filum_wasm_bg.wasm")) });
    engine = new StitchEngine();
  }
  return engine;
}

/** The plan as the app gets it (engine/worker.ts). */
export function planOfDoc(doc: StitchDocument): PlanData {
  const r = eng().plan(JSON.stringify(doc)) as { coords: Float32Array; flags: Uint8Array; objects: Uint32Array; meta: string };
  const meta = JSON.parse(r.meta);
  return { coords: r.coords, flags: r.flags, objects: r.objects, threads: meta.threads, stats: meta.stats, basting: meta.basting ?? null, links: meta.links ?? [] };
}

/** A running stitch going back and forth over the hoop: more than 1,000 stitches, two threads. */
export function thousand(): { doc: StitchDocument; plan: PlanData } {
  const zigzag = (id: string, thread: string, y0: number, y1: number): DesignObject => {
    const nodes: { p: [number, number] }[] = [];
    for (let y = y0, k = 0; y <= y1; y += 3, k++) {
      nodes.push({ p: [k % 2 ? 95 : 5, y] }, { p: [k % 2 ? 5 : 95, y] });
    }
    return {
      id,
      name: id,
      thread,
      visible: true,
      locked: false,
      paths: [{ closed: false, nodes }],
      stitch: { type: "running", length: 2.5, tolerance: 0.2, repeats: 1, beanRepeats: 0 },
      trimAfter: false,
      stopAfter: false,
    } as DesignObject;
  };
  const doc: StitchDocument = {
    ...emptyDoc(),
    name: "Percorso ago",
    threads: [
      { id: "t1", name: "Rosso", color: "#cc0000", brand: "", code: "" },
      { id: "t2", name: "Blu", color: "#0033cc", brand: "", code: "" },
    ],
    objects: [zigzag("A", "t1", 5, 47), zigzag("B", "t2", 53, 95)],
  };
  return { doc, plan: planOfDoc(doc) };
}

/** A plan from records [x, y, flags] and the colours of its colour blocks. */
export function planOf(recs: number[][], colors: string[] = ["#cc0000"]): PlanData {
  return {
    coords: Float32Array.from(recs.flatMap((r) => [r[0], r[1]])),
    flags: Uint8Array.from(recs.map((r) => r[2])),
    objects: new Uint32Array(recs.length),
    threads: colors.map((c, i) => ({ id: `t${i}`, name: c, color: c, brand: "", code: "" })),
    stats: { stitches: recs.filter((r) => !(r[2] & (FLAG.COMMANDS | FLAG.JUMP))).length } as PlanData["stats"],
  };
}
