// Modulo i: i testi di Filum. Ogni file di Filum prende t() da qui, così i
// cataloghi filum (it.json, en.json) sono caricati prima del primo testo.

import { addCatalog, t } from "../../core/i18n";
import it from "./it.json";
import en from "./en.json";

addCatalog(it as Record<string, string>, en as Record<string, string>);

export { t, useLanguage } from "../../core/i18n";

/** Testo con un numero: la chiave "<key>.one" se n è 1, altrimenti "<key>.other"; {n} è il numero. */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? "one" : "other"}`, { n, ...vars });
}
