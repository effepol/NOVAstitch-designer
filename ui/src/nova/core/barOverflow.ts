// The bottom bar's «More» menu (module 0, Signor Poletti 25/11): every button
// stays reachable. When the bar has no room, the least used buttons go into
// the menu, in this order: the modules' buttons (the last registered first:
// Filum's bar stays as Filum had it as long as there is room, rule i.3), then
// Filum's least used, Video and the zoom buttons (6×, 0.5×, 4×, 2×, 1×).
// «Animate», Fit and the hoop button never go.

/** The zoom buttons, the least used first. */
const ZOOM_ORDER = ["6", "0.5", "4", "2", "1"];

/** The keys in the order they go into the menu. `zooms`: "zoom:<z>"; `buttons`: the registered buttons' ids, in bar order. */
export function overflowOrder(zooms: string[], buttons: string[]): string[] {
  const z = [...zooms].sort((a, b) => ZOOM_ORDER.indexOf(a.slice(5)) - ZOOM_ORDER.indexOf(b.slice(5)));
  return [...[...buttons].reverse(), "video", ...z];
}

/**
 * Which keys go into the menu: none when everything fits in `available` px;
 * else the first of `order`, one by one, until what is left, with the «More»
 * button (`moreWidth`), fits, or every one of them has gone.
 * `fixed`: the width of what never goes (swatches at their least, Fit, Animate, gaps…).
 */
export function hiddenForWidth(order: string[], widths: Map<string, number>, fixed: number, available: number, moreWidth: number): string[] {
  let total = fixed + order.reduce((s, k) => s + (widths.get(k) ?? 0), 0);
  if (total <= available + 0.5) return [];
  total += moreWidth;
  const out: string[] = [];
  for (const k of order) {
    if (total <= available + 0.5) break;
    out.push(k);
    total -= widths.get(k) ?? 0;
  }
  return out;
}
