// Module n: the pictures of the varieties in the list. Each is sewn by the
// core on a sample (tatami 12×12 mm, satin 20×5 mm, no underlay so the pattern
// shows) and drawn as the needle's path; made once per variety and kept in
// memory.

import { emptyDoc } from "../../store";
import { defaultStitch, rectPath } from "../../lib/geometry";
import { FLAG, type DesignObject, type PlanData, type StitchDocument, type StitchParams } from "../../types";
import type { Patch, VarietyKind } from "./varieties";

/** The core's plan of a document (the app: the engine's export plan, which does not replace the editor's). */
export type PlanFn = (doc: StitchDocument) => Promise<PlanData> | PlanData;

const SAMPLE = { tatami: [12, 12], satin: [20, 5] } as const;
/** Rows (and satin stitches) 1 mm apart on the sample, so the needle points show in a small picture. */
const SAMPLE_SPACING = 1;

/** The sample sewn with a variety's fields. */
export function sampleDoc(kind: VarietyKind, patch: Patch): StitchDocument {
  const base: StitchParams =
    kind === "tatami"
      ? { ...(defaultStitch("fill") as Extract<StitchParams, { type: "fill" }>), method: "tatami", angle: 0, rowSpacing: SAMPLE_SPACING, underlay: false, underlayAuto: false }
      : { ...(defaultStitch("satin") as Extract<StitchParams, { type: "satin" }>), width: SAMPLE.satin[1], spacing: SAMPLE_SPACING, centerWalk: false, contourUnderlay: false, zigzagUnderlay: false, underlayAuto: false };
  const stitch = { ...(base as unknown as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete stitch[k];
    else stitch[k] = v;
  }
  const [w, h] = SAMPLE[kind];
  const paths = kind === "tatami" ? [rectPath(0, 0, w, h)] : [{ closed: false, nodes: [{ p: [0, h / 2] as [number, number] }, { p: [w, h / 2] as [number, number] }] }];
  const o: DesignObject = { id: "n-sample", name: "sample", thread: "n", visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch: stitch as unknown as StitchParams };
  return { ...emptyDoc(), threads: [{ id: "n", name: "n", color: "#000000", brand: "", code: "" }], objects: [o] };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The plan's stitches as an SVG picture (lines in the current text colour). */
export function planSvg(plan: PlanData): string {
  const { coords, flags } = plan;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const keep = (i: number) => !(flags[i] & FLAG.COMMANDS);
  for (let i = 0; i < flags.length; i++) {
    if (!keep(i)) continue;
    x0 = Math.min(x0, coords[2 * i]);
    x1 = Math.max(x1, coords[2 * i]);
    y0 = Math.min(y0, coords[2 * i + 1]);
    y1 = Math.max(y1, coords[2 * i + 1]);
  }
  if (!Number.isFinite(x0)) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>`;
  let d = "";
  let dots = "";
  let pen = false;
  for (let i = 0; i < flags.length; i++) {
    if (!keep(i)) {
      pen = false;
      continue;
    }
    const [x, y] = [r2(coords[2 * i] - x0), r2(coords[2 * i + 1] - y0)];
    d += `${pen ? "L" : "M"}${x} ${y}`;
    dots += `M${x} ${y}h0`;
    pen = true;
  }
  const pad = 0.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${r2(x1 - x0 + 2 * pad)} ${r2(y1 - y0 + 2 * pad)}"><path d="${d}" fill="none" stroke="#333" stroke-width="0.1" stroke-linejoin="round" opacity="0.55"/><path d="${dots}" stroke="#cc1219" stroke-width="0.55" stroke-linecap="round"/></svg>`;
}

const cache = new Map<string, Promise<string>>();

/** The picture of a variety (`key`: its id), made by the core once and kept. */
export function thumbnail(key: string, kind: VarietyKind, patch: Patch, plan: PlanFn): Promise<string> {
  const k = `${kind}:${key}`;
  let p = cache.get(k);
  if (!p) {
    p = Promise.resolve(plan(sampleDoc(kind, patch))).then(planSvg);
    // a failed picture is made again next time
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

/** How many pictures are kept (tests). */
export const thumbnailCount = (): number => cache.size;
