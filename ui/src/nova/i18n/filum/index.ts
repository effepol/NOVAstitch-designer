// Modulo i: i testi di Filum. Ogni file di Filum prende t() da qui, così i
// cataloghi filum (it.json, en.json) sono caricati prima del primo testo.
//
// Il nome del programma sta in una sola chiave, filum.app.name: nei testi si
// scrive {app}, e t() lo riempie da sé.

import { addCatalog, t as coreT } from "../../core/i18n";
import it from "./it.json";
import en from "./en.json";

addCatalog(it as Record<string, string>, en as Record<string, string>);

export { useLanguage } from "../../core/i18n";

/** Il nome del programma, nella lingua corrente. */
export const appName = (): string => coreT("filum.app.name");

/** Il testo di una chiave nella lingua corrente; {app} è il nome del programma, gli altri {nome} vengono da `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return coreT(key, { app: appName(), ...vars });
}

/** Testo con un numero: la chiave "<key>.one" se n è 1, altrimenti "<key>.other"; {n} è il numero. */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? "one" : "other"}`, { n, ...vars });
}
