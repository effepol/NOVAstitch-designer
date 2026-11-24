// What the export summary and the preset card show (module e). Since module l
// the data come from its sheetData (worksheet/sheetData.ts), the one source of
// the work sheet and of this summary (Architect, 19/11): the preset in force
// with its structured fields, the needle point, the notes for the special
// objects (cap frame, appliqué, foam 3D, layered 3D, metallic thread) and,
// with a plan, the thread metres of the job.

import type { PlanData, StitchDocument } from "../../types";
import { SHEET_BOXES, sheetData, type SheetBox } from "../worksheet/sheetData";
import type { FabricPreset, NeedlePoint } from "./preset";

export type SummaryBox = SheetBox;
export const BOXES: SummaryBox[] = SHEET_BOXES;

export interface Summary {
  preset: FabricPreset | null;
  /** Round point if the preset says so (knits) or there is foam (contract, module l). */
  needlePoint: NeedlePoint;
  boxes: SummaryBox[];
  /** Top and bobbin thread of the job (m), with a plan; the same as the work sheet's totals. */
  thread: { topM: number; bobbinM: number } | null;
}

export function exportSummary(doc: StitchDocument, plan: PlanData | null = null): Summary {
  const s = sheetData(doc, plan, "");
  return { preset: s.preset, needlePoint: s.needlePoint, boxes: s.boxes, thread: plan ? { topM: s.totals.topM, bobbinM: s.totals.bobbinM } : null };
}
