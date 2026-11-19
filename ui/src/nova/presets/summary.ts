// What the export summary and the preset card show (module e). Module e's own
// data until module l's sheetData arrives (Architect, 19/11): the preset in
// force with its structured fields and info sheet, and the notes for the
// special objects (contract, module l: cap frame, appliqué, foam 3D, layered 3D,
// metallic thread). Foam and layered 3D are module j's stitch types: they are
// recognised through module 0's stitch type registry.

import type { StitchDocument } from "../../types";
import { stitchTypeOf } from "../core/stitchTypes";
import type { FabricPreset, NeedlePoint } from "./preset";
import { presetOf } from "./registry";

export type SummaryBox = "cap" | "applique" | "foam" | "layered3d" | "metallic";
export const BOXES: SummaryBox[] = ["cap", "applique", "foam", "layered3d", "metallic"];

export interface Summary {
  preset: FabricPreset | null;
  /** Round point if the preset says so (knits) or there is foam (contract, module l). */
  needlePoint: NeedlePoint;
  boxes: SummaryBox[];
}

export function exportSummary(doc: StitchDocument): Summary {
  const preset = presetOf(doc);
  const has = new Set<SummaryBox>();
  if (doc.nova?.hoopKind === "cap") has.add("cap");
  for (const o of doc.objects) {
    if (!o.visible) continue;
    if (o.stitch.type === "applique") has.add("applique");
    const type = stitchTypeOf(o.stitch)?.id;
    if (type === "j.foam") has.add("foam");
    if (type === "j.layered3d") has.add("layered3d");
  }
  const used = new Set(doc.objects.filter((o) => o.visible).map((o) => o.thread));
  if (doc.threads.some((th) => used.has(th.id) && (th as { nova?: { kind?: string } }).nova?.kind === "metallic")) has.add("metallic");
  return {
    preset,
    needlePoint: has.has("foam") || preset?.needlePoint === "ballpoint" ? "ballpoint" : "normal",
    boxes: BOXES.filter((b) => has.has(b)),
  };
}
