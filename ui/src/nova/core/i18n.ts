// Texts (contract, section 3): every visible string comes from t("<module>.<key>"),
// with each module's it.json and en.json in its own folder. The language is the
// system's by default (Italian or English, else English); a choice is saved in prefs.

import { useSyncExternalStore } from "react";
import coreIt from "./it.json";
import coreEn from "./en.json";

export type Language = "it" | "en";
export const LANGUAGES: Language[] = ["it", "en"];
/** Used when the system's language is neither. */
export const FALLBACK: Language = "en";

const catalogs: Record<Language, Record<string, string>> = { it: {}, en: {} };
let current: Language = FALLBACK;
const listeners = new Set<() => void>();

/** Add a module's catalogs (flat: "module.key": "text"). */
export function addCatalog(it: Record<string, string>, en: Record<string, string>): void {
  Object.assign(catalogs.it, it);
  Object.assign(catalogs.en, en);
}
addCatalog(coreIt, coreEn);

const supported = (tag: string | null | undefined): Language | null => {
  const base = (tag ?? "").toLowerCase().split(/[-_]/)[0];
  return (LANGUAGES as string[]).includes(base) ? (base as Language) : null;
};

/** The language at start: a saved choice, else the first supported one in the system's list, else English. */
export function initLanguage(o: { system: readonly string[]; saved?: string | null }): Language {
  const lang = supported(o.saved) ?? o.system.map(supported).find((l): l is Language => !!l) ?? FALLBACK;
  setLanguage(lang);
  return lang;
}

export const getLanguage = (): Language => current;

/** Change the language now; every t() and every component using useLanguage follows. */
export function setLanguage(lang: Language): void {
  if (lang === current) return;
  current = lang;
  for (const fn of [...listeners]) fn();
}

export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The text of a key in the current language; {name} placeholders filled from `vars`. A missing key shows itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = catalogs[current][key] ?? catalogs[FALLBACK][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** React: re-render when the language changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(onLanguageChange, getLanguage);
}
