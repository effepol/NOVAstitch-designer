// Module 0's own menu items: the interface language (Edit menu, beside the preferences).

import { registerMenuItem } from "./registry";
import { getLanguage, LANGUAGES } from "./i18n";
import { chooseLanguage } from "./language";

export function registerCoreItems(): void {
  for (const [k, lang] of LANGUAGES.entries())
    registerMenuItem({
      id: `core.language.${lang}`,
      module: "core",
      menu: "Edit",
      order: -100 + k,
      label: `core.menu.language.${lang}`,
      checked: () => getLanguage() === lang,
      run: () => void chooseLanguage(lang),
    });
}
