// The layers panel's module tabs (module 0, note 1 on build 0.1.1, Architect
// 26/11): the ones that do not fit go into «More», the last registered first;
// the open tab always stays in view.

import { hiddenForWidth } from "./barOverflow";

/** The module tabs (`ids`, in tab order) that go into «More»; `fixed`: the width of the rest of the tab row. */
export function tabsInMore(ids: string[], widths: Map<string, number>, fixed: number, available: number, moreWidth: number, active: string): string[] {
  const open = ids.includes(active) ? (widths.get(active) ?? 0) : 0;
  return hiddenForWidth([...ids].reverse().filter((k) => k !== active), widths, fixed + open, available, moreWidth);
}
