// Module l's test helpers: the real engine (WebAssembly, as the app's worker
// uses it), designs of straight running lines, the presets shipped with module e.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { emptyDoc } from "../../store";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject, PlanData, StitchDocument, Thread } from "../../types";
import { loadPresets } from "../presets/preset";
import { setPresetList } from "../presets/registry";

initSync({ module: readFileSync(path.join(process.cwd(), "src", "wasm", "pkg", "filum_wasm_bg.wasm")) });
const engine = new StitchEngine();

/** The plan as the app's engine worker gives it (engine/worker.ts). */
export function planOf(doc: StitchDocument): PlanData {
  const r = engine.plan(JSON.stringify(doc)) as { coords: Float32Array; flags: Uint8Array; objects: Uint32Array; meta: string };
  const meta = JSON.parse(r.meta);
  return { coords: r.coords, flags: r.flags, objects: r.objects, threads: meta.threads, stats: meta.stats, basting: meta.basting ?? null, links: meta.links ?? [] };
}

export function loadShippedPresets(): void {
  const dir = path.resolve(process.cwd(), "src/nova/presets/fabric");
  const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(path.join(dir, f), "utf8")]));
  setPresetList(loadPresets(files).presets);
}

export const thread = (id: string, color: string, over: Partial<Thread> = {}): Thread => ({ id, name: id, color, brand: "Madeira", code: id.replace(/\D/g, "") || "1", ...over });

/** A straight running line of `len` mm at height y, in thread `th`. */
export function line(id: string, th: string, y: number, len = 40, x = 10): DesignObject {
  return {
    id,
    name: id,
    thread: th,
    visible: true,
    locked: false,
    trimAfter: false,
    stopAfter: false,
    paths: [{ closed: false, nodes: [{ p: [x, y] }, { p: [x + len, y] }] }],
    stitch: defaultStitch("running"),
  } as DesignObject;
}

export const design = (objects: DesignObject[], threads: Thread[], over: Partial<StitchDocument> = {}): StitchDocument => ({
  ...emptyDoc(),
  name: "progetto",
  objects,
  threads,
  ...over,
});
