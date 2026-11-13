// Module f: the patch settings the user is preparing (panel and menu item share them).

import type { PatchParams } from "./patch";

export type PatchDraft = Omit<PatchParams, "sourceIds">;

let draft: PatchDraft = { rows: 2, cols: 2, gap: [5, 5], order: "rows", colorGrouping: "byColor" };
const listeners = new Set<() => void>();

export const getDraft = (): PatchDraft => draft;
export function setDraft(p: Partial<PatchDraft>): void {
  draft = { ...draft, ...p };
  for (const fn of [...listeners]) fn();
}
export function onDraft(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
