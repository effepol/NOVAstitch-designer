// Modulo i — il riferimento inglese di Filum 0.2.1 (riferimento-en-0.2.1.json) contiene solo
// scritte di Filum: nessuna scritta dei cataloghi en.json dei moduli (contratto, regola i.3,
// correzione del 13/11). Una parola che è anche di Filum («Close», «Back») non conta: deve
// comparire nel codice di Filum o nel suo catalogo. Il riferimento non si rigenera mai; si corregge solo a mano, con una nota.

import { check, done } from "../../core/testkit";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const nova = path.join(process.cwd(), "src", "nova");
const here = path.join(nova, "i18n", "filum");
const ref = JSON.parse(readFileSync(path.join(here, "riferimento-en-0.2.1.json"), "utf8")) as { testi: string[]; schermate: Record<string, number[]> };

// i cataloghi inglesi dei moduli (non quello di Filum, che è proprio il testo di Filum)
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f === "en.json" ? [p] : [];
  });
const catalogs = walk(nova).filter((f) => f !== path.join(here, "en.json"));
check(catalogs.length > 0, `i ci sono cataloghi dei moduli da controllare (${catalogs.map((f) => path.relative(nova, f)).join(", ")})`);

// come il giro: cifre → #; un segnaposto {nome} vale qualunque testo
const norm = (s: string) => s.replace(/\d+(?:[.,  ]\d+)*/g, "#");
const pattern = (text: string) =>
  new RegExp(
    "^" +
      norm(text)
        .split(/\{\w+\}/)
        .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".+") +
      "$",
  );
check(pattern("Language: {name}").test("Language: English") && !pattern("Hoops").test("My hoops"), "i il confronto con i segnaposto funziona");

// le scritte che sono anche di Filum («Close», «Back», «Custom»): nel codice di Filum o nel suo catalogo
const src = path.join(process.cwd(), "src");
const filumFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return dir === src && f === "nova" ? [] : filumFiles(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const filumEn = JSON.parse(readFileSync(path.join(here, "en.json"), "utf8")) as Record<string, string>;
const filum = [...filumFiles(src).map((f) => readFileSync(f, "utf8")), ...Object.values(filumEn).map((v) => v.replaceAll("{app}", "Filum"))].join("\n");

const found: string[] = [];
for (const f of catalogs) {
  const cat = JSON.parse(readFileSync(f, "utf8")) as Record<string, string>;
  for (const [key, text] of Object.entries(cat)) {
    if (!text.trim()) continue;
    const re = pattern(text);
    for (const t of ref.testi) if (re.test(t) && !filum.includes(t)) found.push(`${path.relative(nova, f)} ${key}: «${t}»`);
  }
}
check(!found.length, `i il riferimento di Filum 0.2.1 non contiene scritte dei moduli (${found.join(" · ") || "nessuna"})`);

// ogni schermata punta a scritte che esistono
const bad = Object.entries(ref.schermate).filter(([, l]) => l.some((i) => !(i >= 0 && i < ref.testi.length)));
check(!bad.length, `i ogni schermata del riferimento punta a scritte esistenti (${bad.map(([id]) => id).join(", ") || "tutte"})`);

done("traduzione di Filum: riferimento");
