// The language at start and the user's choice, kept in the app settings (desktop).

import { isTauri } from "../../lib/platform";
import { prefs } from "./prefs";
import { initLanguage, onLanguageChange, getLanguage, setLanguage, type Language } from "./i18n";

export const LANGUAGE_PREF = "core.language";

const systemLanguages = (): readonly string[] => (typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : []);

/** The system's language now; a saved choice as soon as the settings are read. */
export async function startLanguage(): Promise<Language> {
  onLanguageChange(() => (document.documentElement.lang = getLanguage()));
  initLanguage({ system: systemLanguages() });
  document.documentElement.lang = getLanguage();
  if (!isTauri) return getLanguage();
  try {
    const saved = (await prefs()).get<string>(LANGUAGE_PREF);
    if (saved) initLanguage({ system: systemLanguages(), saved });
  } catch (e) {
    console.error("nova: language choice not read", e);
  }
  return getLanguage();
}

/** The user picks a language: it applies at once and is remembered. */
export async function chooseLanguage(lang: Language): Promise<void> {
  setLanguage(lang);
  if (isTauri) await (await prefs()).set(LANGUAGE_PREF, lang);
}
