// Modulo i — test i.2: codice con title="Hello" scritto a mano → il linter fallisce.
// Il linter è check-texts.mjs; qui lo si lancia su file di prova e sulle aree già tradotte.

import { check, done } from "../../core/testkit";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const linter = path.join(process.cwd(), "src", "nova", "i18n", "filum", "check-texts.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "nova-i2-"));

/** Esito del linter su un sorgente: 0 = nessun testo scritto a mano. */
const lint = (name: string, source: string): { code: number; out: string } => {
  const f = path.join(dir, name);
  writeFileSync(f, source);
  try {
    return { code: 0, out: execFileSync("node", [linter, f], { encoding: "utf8", stdio: "pipe" }) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
};

const hello = lint("Hello.tsx", `export const B = () => <button title="Hello">x</button>;\n`);
check(hello.code === 1 && hello.out.includes('attributo title: "Hello"'), 'i.2 title="Hello" scritto a mano → il linter fallisce');

// anche gli altri posti dove un testo arriva a schermo
const cases: [string, string][] = [
  ["testo fra i tag", `export const A = () => <p>Open file</p>;`],
  ["stringa fra i tag", `export const A = (o: boolean) => <p>{o ? "Close" : "Open"}</p>;`],
  ["placeholder", `export const A = () => <input placeholder="Search" />;`],
  ["aria-label", `export const A = () => <button aria-label="Close" />;`],
  ["proprietà label", `export const items = [{ label: "New design" }];`],
  ["template", "export const A = (n: number) => <b title={`${n} stitches`} />;"],
  ["messaggio", `declare const s: { toast(m: string): void }; s.toast("Saved");`],
  ["proprietà group", `export const groups = [{ group: "Everywhere", rows: [] }];`],
  ["template in un elenco", "export const tabs = (n: number) => [[\"fonts\", `Fonts (${n})`]];"],
];
for (const [name, code] of cases) {
  const r = lint(`case-${name.replace(/\W/g, "")}.tsx`, code);
  check(r.code === 1 && r.out.includes("usare t("), `i.2 il linter rifiuta: ${name}`);
}

// e lascia passare i testi tradotti, le sigle e le eccezioni dichiarate
const ok = lint(
  "Ok.tsx",
  [
    `import { t } from "./x";`,
    `export const A = () => <button title={t("filum.menu.file.new")}>{t("filum.menu.file.open")}</button>;`,
    `export const B = () => <span>mm</span>;`,
    `export const C = () => <i className="icon-x" data-id="Hello" />;`,
    `// testo-ok: nome del file d'esempio`,
    `export const D = () => <span>Sample.filum</span>;`,
  ].join("\n"),
);
check(ok.code === 0, `i.2 t("…"), sigle e testo-ok passano (${ok.out.trim()})`);

// le aree già tradotte non hanno testi scritti a mano
let areas = 0;
try {
  execFileSync("node", [linter], { encoding: "utf8", stdio: "pipe" });
} catch (e) {
  areas = (e as { status: number }).status;
  console.log((e as { stdout: string }).stdout);
}
check(areas === 0, "i.2 nelle aree tradotte (aree.json) nessun testo scritto a mano");

done("traduzione di Filum: linter");
