// Module b's tests: Filum's engine (the WebAssembly build, as the app runs it)
// in Node, and a reader of the DST it exports.

import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm.js";
import type { StitchDocument } from "../../types";

let engine: StitchEngine | null = null;
function eng(): StitchEngine {
  if (!engine) {
    initSync({ module: readFileSync(path.resolve(process.cwd(), "src/wasm/pkg/filum_wasm_bg.wasm")) });
    engine = new StitchEngine();
  }
  return engine;
}

export type DstKind = "stitch" | "jump" | "color" | "end";
export interface DstRecord {
  kind: DstKind;
  /** Absolute position, 0.1 mm (y down). */
  x: number;
  y: number;
}

const bit = (b: number, p: number) => (b >> p) & 1;

/** The records of a DST file (Filum writes colour changes and stops both as colour changes). */
export function readDst(bytes: Uint8Array): DstRecord[] {
  const out: DstRecord[] = [];
  let x = 0;
  let y = 0;
  for (let i = 512; i + 2 < bytes.length; i += 3) {
    const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    if ((b2 & 0xf3) === 0xf3) {
      out.push({ kind: "end", x, y });
      break;
    }
    if ((b2 & 0xc3) === 0xc3) {
      out.push({ kind: "color", x, y });
      continue;
    }
    x += 81 * (bit(b2, 2) - bit(b2, 3)) + 27 * (bit(b1, 2) - bit(b1, 3)) + 9 * (bit(b0, 2) - bit(b0, 3)) + 3 * (bit(b1, 0) - bit(b1, 1)) + (bit(b0, 0) - bit(b0, 1));
    y -= 81 * (bit(b2, 5) - bit(b2, 4)) + 27 * (bit(b1, 5) - bit(b1, 4)) + 9 * (bit(b0, 5) - bit(b0, 4)) + 3 * (bit(b1, 7) - bit(b1, 6)) + (bit(b0, 7) - bit(b0, 6));
    out.push({ kind: (b2 & 0x83) === 0x83 ? "jump" : "stitch", x, y });
  }
  return out;
}

/** Where Filum's DST writer put a trim: three jumps going (+2,+2), (−4,−4), (+2,+2) — indices of the first jump. */
export function dstTrims(recs: DstRecord[]): number[] {
  const at: number[] = [];
  for (let i = 1; i + 2 < recs.length; i++) {
    const [p, a, b, c] = [recs[i - 1], recs[i], recs[i + 1], recs[i + 2]];
    if (a.kind !== "jump" || b.kind !== "jump" || c.kind !== "jump") continue;
    const d = (r: DstRecord, q: DstRecord) => [r.x - q.x, r.y - q.y];
    const [d1, d2, d3] = [d(a, p), d(b, a), d(c, b)];
    if (d1[0] === 2 && d2[0] === -4 && d3[0] === 2 && Math.abs(d1[1]) === 2 && Math.abs(d2[1]) === 4) at.push(i);
  }
  return at;
}

/** The design exported to DST by Filum's engine. */
export function exportDst(doc: StitchDocument): DstRecord[] {
  return readDst(eng().export(JSON.stringify(doc), "dst", "{}"));
}

/** The stitch plan (flags and object index of every record). */
export function planOfDoc(doc: StitchDocument): { flags: Uint8Array; objects: Uint32Array } {
  const p = eng().plan(JSON.stringify(doc)) as { flags: Uint8Array; objects: Uint32Array };
  return { flags: p.flags, objects: p.objects };
}
