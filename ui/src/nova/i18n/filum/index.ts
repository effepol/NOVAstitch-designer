// Modulo i: i testi di Filum. Ogni file di Filum prende t() da qui, così i
// cataloghi filum (it.json, en.json) sono caricati prima del primo testo.
//
// Il nome del programma sta in una sola chiave, filum.app.name: nei testi si
// scrive {app}, e t() lo riempie da sé.

import { addCatalog, getLanguage, t as coreT } from "../../core/i18n";
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

/**
 * Il testo inglese di Filum per un testo mostrato nella lingua corrente (anche più d'uno,
 * se due testi inglesi hanno la stessa traduzione). Serve dove Filum confronta o salva
 * etichette (menu del tasto destro, comandi recenti) e per cercare i comandi anche in
 * inglese. Un testo che non viene dai cataloghi resta com'è.
 */
export function inEnglish(text: string): string[] {
  if (getLanguage() === "en") return [text];
  const app = appName();
  if (!reverse) {
    reverse = new Map();
    for (const [k, v] of Object.entries(it as Record<string, string>)) {
      const english = (en as Record<string, string>)[k];
      if (!english || !k.startsWith("filum.")) continue;
      const shown = v.replaceAll("{app}", app);
      reverse.set(shown, [...(reverse.get(shown) ?? []), english.replaceAll("{app}", app)]);
    }
  }
  return reverse.get(text) ?? [text];
}
let reverse: Map<string, string[]> | null = null;

/**
 * Una voce di un elenco di Filum con i suoi testi presi dal catalogo: ogni campo di
 * `fields` diventa un getter che legge "<prefix>.<id>.<campo>" nella lingua corrente
 * (l'elenco si crea una volta sola, quando la lingua non è ancora scelta).
 */
export function withTexts<T extends { id: string }, K extends string>(prefix: string, fields: readonly K[], item: T): T & { readonly [k in K]: string } {
  for (const f of fields) Object.defineProperty(item, f, { get: () => t(`${prefix}.${item.id}.${f}`), enumerable: true });
  return item as T & { readonly [k in K]: string };
}
