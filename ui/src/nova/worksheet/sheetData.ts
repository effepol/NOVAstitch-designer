// The work sheet's data (module l): ONE source for the PDF and for the summary
// at export (module e's card reads it through presets/summary.ts). Pure: the
// document, its stitch plan and the file name in, the data out.
//
// Contract «l — Scheda di lavoro (PDF)»:
//   rows     one per colour block, in sewing order (a thread used twice = two rows)
//   metres   from the engine's PlanStats (crates/core/src/plan.rs, formula of
//            Signor Poletti), the same numbers as every other view (l.7)
//   needle   by thread weight (Punch pp. 60–71, Madeira table): 40 → 65/9–75/11,
//            60 → 65/9, 30 → 75/11, 12 → 100/16; the job's needle = the one of
//            the heaviest thread (lowest weight number); metallic: «special needle»
//   point    round if the preset says so (knits) or there is foam
//   boxes    cap frame, appliqué, foam 3D, layered 3D, metallic thread
// No estimated time (l.16).

import type { Fabric, PlanData, PlanStats, StitchDocument, Thread, ThreadWeight } from "../../types";
import { stitchTypeOf } from "../core/stitchTypes";
import type { FabricPreset, NeedlePoint } from "../presets/preset";
import { presetOf } from "../presets/registry";

export type ThreadKind = "standard" | "metallic";
export type SheetBox = "cap" | "applique" | "foam" | "layered3d" | "metallic";
export const SHEET_BOXES: SheetBox[] = ["cap", "applique", "foam", "layered3d", "metallic"];

/** A needle: its size, or null for the special needle of metallic thread. */
export interface Needle {
  size: string | null;
  /** Burmilana 12: tension on the top thread only. */
  note?: "topTensionOnly";
}

export interface SheetRow {
  /** 1, 2, 3… in sewing order. */
  n: number;
  /** The design's thread (brand, code, name, colour). */
  thread: Thread;
  kind: ThreadKind;
  weight: ThreadWeight;
  needle: Needle;
  /** Its needle is not the job's (the row says so). */
  needleDiffers: boolean;
  stitches: number;
  trims: number;
  /** Top and bobbin thread (m). */
  topM: number;
  bobbinM: number;
}

export interface SheetData {
  /** The stitch file's name (the exported file, or the project's .nsd). */
  fileName: string;
  /** Design size (mm). */
  width: number;
  height: number;
  stitches: number;
  jumps: number;
  trims: number;
  colorChanges: number;
  /** The fabric preset in force (module e): stabiliser, topping, needle point. */
  preset: FabricPreset | null;
  fabric: Fabric;
  needlePoint: NeedlePoint;
  hoop: { name: string; width: number; height: number; kind: "flat" | "cap" };
  boxes: SheetBox[];
  rows: SheetRow[];
  totals: { stitches: number; trims: number; topM: number; bobbinM: number };
  /** The job's needle: the heaviest standard thread's. */
  jobNeedle: Needle;
}

/** Needle by thread weight (contract; 75 is not in the book's table: Filum's 60/8). */
export const NEEDLES: Record<ThreadWeight, Needle> = {
  75: { size: "60/8" },
  60: { size: "65/9" },
  40: { size: "65/9–75/11" },
  30: { size: "75/11" },
  12: { size: "100/16", note: "topTensionOnly" },
};
export const SPECIAL_NEEDLE: Needle = { size: null };

export const threadKind = (th: Thread | undefined): ThreadKind => (th?.nova?.kind === "metallic" ? "metallic" : "standard");

/** The weight a thread is sewn with: its own, else the design's, else 40. */
export function weightOf(doc: StitchDocument, th: Thread | undefined): ThreadWeight {
  const w = (th?.weight ?? doc.options?.threadWeight ?? 40) as ThreadWeight;
  return w in NEEDLES ? w : 40;
}

/** The project's file name, for the sheet printed from the menu before any export. */
export function projectFileName(doc: StitchDocument, filePath: string | null | undefined): string {
  const base = filePath ? (filePath.split(/[\\/]/).pop() ?? "") : "";
  if (/\.nsd$/i.test(base)) return base;
  const stem = base ? base.replace(/\.[^.]*$/, "") : (doc.name || "design").trim();
  return `${stem}.nsd`;
}

/** The boxes of the special work in a design (only what is sewn: visible objects). */
export function sheetBoxes(doc: StitchDocument): SheetBox[] {
  const has = new Set<SheetBox>();
  if (doc.nova?.hoopKind === "cap") has.add("cap");
  const visible = doc.objects.filter((o) => o.visible);
  for (const o of visible) {
    if (o.stitch.type === "applique") has.add("applique");
    const type = stitchTypeOf(o.stitch)?.id;
    if (type === "j.foam") has.add("foam");
    if (type === "j.layered3d") has.add("layered3d");
  }
  const used = new Set(visible.map((o) => o.thread));
  if (doc.threads.some((th) => used.has(th.id) && threadKind(th) === "metallic")) has.add("metallic");
  return SHEET_BOXES.filter((b) => has.has(b));
}

/** The engine's per-colour figures (plan.rs); trims counted from the records when an older engine left them out. */
type Stats = PlanStats & { bobbinPerColorM?: number[]; trimsPerColor?: number[] };

function trimsPerBlock(plan: PlanData): number[] {
  const out = plan.threads.map(() => 0);
  let k = 0;
  for (const f of plan.flags) {
    if (f & 4) k++;
    else if (f & 2 && k < out.length) out[k]++;
  }
  return out;
}

export function sheetData(doc: StitchDocument, plan: PlanData | null, fileName: string): SheetData {
  const preset = presetOf(doc);
  const boxes = sheetBoxes(doc);
  const stats = plan?.stats as Stats | undefined;
  const byId = new Map(doc.threads.map((t) => [t.id, t]));
  const trims = plan ? (stats?.trimsPerColor ?? trimsPerBlock(plan)) : [];
  const rows: SheetRow[] = (plan?.threads ?? []).map((pt, i) => {
    // the design's thread (the plan carries only Filum's fields)
    const thread = byId.get(pt.id) ?? doc.threads.find((x) => x.color.toLowerCase() === pt.color.toLowerCase()) ?? pt;
    const kind = threadKind(thread);
    const weight = weightOf(doc, thread);
    return {
      n: i + 1,
      thread,
      kind,
      weight,
      needle: kind === "metallic" ? SPECIAL_NEEDLE : NEEDLES[weight],
      needleDiffers: false,
      stitches: stats?.stitchesPerColor[i] ?? 0,
      trims: trims[i] ?? 0,
      topM: stats?.threadPerColorM[i] ?? 0,
      bobbinM: stats?.bobbinPerColorM?.[i] ?? 0,
    };
  });
  const standard = rows.filter((r) => r.kind === "standard");
  const jobNeedle = standard.length
    ? NEEDLES[Math.min(...standard.map((r) => r.weight)) as ThreadWeight]
    : rows.length
      ? SPECIAL_NEEDLE
      : NEEDLES[weightOf(doc, undefined)];
  for (const r of rows) r.needleDiffers = r.needle.size !== jobNeedle.size;
  return {
    fileName,
    width: stats?.width ?? 0,
    height: stats?.height ?? 0,
    stitches: stats?.stitches ?? 0,
    jumps: stats?.jumps ?? 0,
    trims: stats?.trims ?? 0,
    colorChanges: stats?.colorChanges ?? 0,
    preset,
    fabric: doc.fabric,
    needlePoint: boxes.includes("foam") || preset?.needlePoint === "ballpoint" ? "ballpoint" : "normal",
    hoop: { name: doc.hoop.name, width: doc.hoop.width, height: doc.hoop.height, kind: doc.nova?.hoopKind === "cap" ? "cap" : "flat" },
    boxes,
    rows,
    totals: {
      stitches: rows.reduce((a, r) => a + r.stitches, 0),
      trims: rows.reduce((a, r) => a + r.trims, 0),
      // the engine's totals: the sum of its rows
      topM: stats?.threadM ?? 0,
      bobbinM: stats?.bobbinM ?? 0,
    },
    jobNeedle,
  };
}
