// Numbers as module l prints them, the same in the PDF and in the summary at
// export: metres with two decimals, the decimal comma in Italian.

import type { Language } from "../core/i18n";

export function decimal(n: number, digits: number, lang: Language): string {
  const s = n.toFixed(digits);
  return lang === "it" ? s.replace(".", ",") : s;
}

/** Thread metres: «16,70» / «16.70». */
export const metres = (m: number, lang: Language): string => decimal(m, 2, lang);

/** Whole numbers with the thousands separator: «12.345» / «12,345». */
export const whole = (n: number, lang: Language): string =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "it" ? "." : ",");
