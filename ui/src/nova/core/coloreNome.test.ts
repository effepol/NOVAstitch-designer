// Settings › Highlight colour (module 0, from the trials of build 1, Signor
// Poletti 25/11): the program's own colour swatch shows its catalogue label
// («Rosso NOVAstitch Designer»), not «Filum» written in the code.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setLanguage } from "./i18n";
import { ACCENTS, APP_COLOR } from "../../lib/prefs";
import { SettingsDialog } from "../../components/SettingsDialog";

const own = ACCENTS.find((a) => a.color === APP_COLOR)!;
for (const lang of ["it", "en"] as const) {
  setLanguage(lang);
  const html = renderToStaticMarkup(createElement(SettingsDialog, { onClose: () => {} }));
  const swatch = html.match(/<div class="st-accents">.*?<\/button>/s)?.[0] ?? "";
  check(swatch.includes(`<span>${own.label}</span>`), `${lang}: the program's colour swatch shows «${own.label}»`);
  check(!/<span>Filum<\/span>/.test(html), `${lang}: no «Filum» swatch`);
}
setLanguage("it");
check(own.label === "Rosso NOVAstitch Designer", "(Italian label: «Rosso NOVAstitch Designer»)");
const src = readFileSync(path.join(process.cwd(), "src", "components", "SettingsDialog.tsx"), "utf8");
check(!/"Filum"/.test(src), "SettingsDialog.tsx writes no «Filum» in the code");

done("nome del colore del programma");
