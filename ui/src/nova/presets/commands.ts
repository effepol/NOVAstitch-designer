// Module e's commands, all marked system (contract, module e): what they
// change is the program's doing, not a manual edit, so nova.edited is not
// touched by module 0's record. Each is one undo step.
//   e.preset.apply({presetId})  the preset in force, its values in the objects
//   e.param.reset({id, param})  the parameter out of nova.edited, back to the preset's value
//   e.issue.fix({issueId})      the one-click fix of one of module e's warnings
// Event: preset.applied({presetId, changedObjects, skippedParams}).

import { registerCommand } from "../core/commands";
import { emit, on } from "../core/events";
import { useStore } from "../../store";
import type { PlanData, StitchDocument } from "../../types";
import { applyPreset, resetParam, type ApplyResult } from "./apply";
import { fabricIssues } from "./issues";
import { presetById, presetOf } from "./registry";

declare module "../core/events" {
  interface NovaEvents {
    "preset.applied": { presetId: string; changedObjects: string[]; skippedParams: { id: string; params: string[] }[] };
  }
}

export interface ApplyParams {
  presetId: string;
}
export interface ResetParams {
  id: string;
  param: string;
}
export interface FixParams {
  issueId: string;
}

/** Register the commands; `plan` gives the current stitch plan (the warnings read it). Returns the function that removes them. */
export function installPresetCommands(plan: () => PlanData | null = () => useStore.getState().plan): () => void {
  // what the last e.preset.apply did, by the document it gave (read when command.executed arrives)
  const results = new WeakMap<StitchDocument, ApplyResult & { presetId: string }>();
  const offs = [
    registerCommand<ApplyParams>({
      id: "e.preset.apply",
      label: { it: "Applica il preset del tessuto", en: "Apply the fabric preset" },
      system: true,
      apply(doc, { presetId }) {
        const p = presetById(presetId);
        if (!p) return doc;
        const r = applyPreset(doc, p);
        results.set(r.doc, { ...r, presetId });
        return r.doc;
      },
    }),
    registerCommand<ResetParams>({
      id: "e.param.reset",
      label: { it: "Rimetti il valore del preset", en: "Back to the preset's value" },
      system: true,
      apply: (doc, { id, param }) => resetParam(doc, id, param),
    }),
    registerCommand<FixParams>({
      id: "e.issue.fix",
      label: { it: "Correggi", en: "Fix" },
      system: true,
      apply(doc, { issueId }) {
        const issue = fabricIssues(doc, plan(), presetOf(doc)).find((i) => i.id === issueId);
        if (!issue?.fix) return doc;
        const scope = issue.fix.scope ?? ((o) => o.id === issue.objId);
        let changed = false;
        const objects = doc.objects.flatMap((o) => {
          if (!scope(o)) return [o];
          const next = issue.fix!.apply(o);
          if (next !== o) changed = true;
          return next ? [next] : [];
        });
        return changed ? { ...doc, objects } : doc;
      },
    }),
    on("command.executed", ({ id }) => {
      if (id !== "e.preset.apply") return;
      const r = results.get(useStore.getState().doc);
      if (r) emit("preset.applied", { presetId: r.presetId, changedObjects: r.changedObjects, skippedParams: r.skippedParams });
    }),
  ];
  return () => offs.forEach((off) => off());
}
