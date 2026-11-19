// Module g: a step's check, worked out on what the program shows now. Pure: it
// reads the design, the selection, the view and the stitch plan, and changes nothing.

import type { DesignObject, PlanStats, StitchDocument, ViewMode } from "../../types";
import type { Condition, Range } from "./lesson";

/** What a check can look at. */
export interface LessonView {
  doc: StitchDocument;
  selection: string[];
  viewMode: ViewMode;
  /** 1 = the design at its real size (module 0's zoom factor). */
  zoom: number;
  /** null while the plan is not ready: a plan condition does not hold yet. */
  stats: PlanStats | null;
}

const inRange = (v: unknown, r: Range | number): boolean => {
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  if (typeof r === "number") return v === r;
  // a little room for numbers typed in mm (3 mm stored as 2.9999999)
  const eps = 1e-9;
  return (r.min === undefined || v >= r.min - eps) && (r.max === undefined || v <= r.max + eps);
};

/** A parameter of the object: in its stitch first ("width", "underlay.x"), then on the object itself. */
function param(o: DesignObject, name: string): unknown {
  const path = name.split(".");
  const get = (from: unknown) => path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), from);
  const inStitch = get(o.stitch);
  return inStitch !== undefined ? inStitch : get(o);
}

export function holds(c: Condition, v: LessonView): boolean {
  if ("all" in c) return c.all.every((x) => holds(x, v));
  if ("any" in c) return c.any.some((x) => holds(x, v));
  if ("not" in c) return !c.not.some((x) => holds(x, v));
  if ("exists" in c) {
    const e = c.exists;
    const n = v.doc.objects.filter(
      (o) =>
        o.stitch.type === e.type &&
        (e.method === undefined || (o.stitch as { method?: unknown }).method === e.method) &&
        Object.entries(e.param ?? {}).every(([k, r]) => inRange(param(o, k), r)),
    ).length;
    return inRange(n, e.count ?? { min: 1 });
  }
  if ("plan" in c) {
    const s = v.stats;
    return !!s && Object.entries(c.plan).every(([k, r]) => inRange(s[k as keyof PlanStats], r as Range));
  }
  if ("view" in c) return (c.view.mode === undefined || c.view.mode === v.viewMode) && (c.view.zoom === undefined || inRange(v.zoom, c.view.zoom));
  if ("selection" in c) return inRange(v.selection.length, c.selection.count);
  // the validator lets no other kind through
  return false;
}
