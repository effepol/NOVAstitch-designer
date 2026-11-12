// Contract test 0.2: every key used with t() exists in it.json and en.json,
// with a text that is not empty.

import { check, done } from "./testkit";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { t, setLanguage } from "./i18n";

const src = path.resolve(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(src);

// the catalogs: every it.json / en.json under src/nova (flat: "module.key": "text")
const catalog = (lang: "it" | "en") => {
  const out: Record<string, unknown> = {};
  for (const f of files.filter((p) => p.includes(`${path.sep}nova${path.sep}`) && path.basename(p) === `${lang}.json`))
    Object.assign(out, JSON.parse(readFileSync(f, "utf8")));
  return out;
};
const it = catalog("it");
const en = catalog("en");
check(Object.keys(it).length > 0 && Object.keys(en).length > 0, "0.2 the catalogs exist");

// every key used in the code: t("a.b") or t('a.b')
const keysIn = (text: string) => [...text.matchAll(/\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g)].map((m) => m[1]);
check(keysIn(`t("a.b"); x.t('c.d', { n: 1 }); format("e.f")`).join() === "a.b,c.d", "0.2 the scan finds t(\"…\") and t('…') keys");
const used = new Set<string>();
for (const f of files.filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))) for (const k of keysIn(readFileSync(f, "utf8"))) used.add(k);
const bad = [...used].filter((k) => typeof it[k] !== "string" || !(it[k] as string).trim() || typeof en[k] !== "string" || !(en[k] as string).trim());
check(bad.length === 0, `0.2 every key used with t() has an Italian and an English text (${used.size} keys; missing: ${bad.join(", ") || "none"})`);

// the two catalogs hold the same keys
const onlyIt = Object.keys(it).filter((k) => !(k in en));
const onlyEn = Object.keys(en).filter((k) => !(k in it));
check(!onlyIt.length && !onlyEn.length, `0.2 it.json and en.json have the same keys (only it: ${onlyIt.join(", ") || "none"}; only en: ${onlyEn.join(", ") || "none"})`);

// t() reads them
setLanguage("it");
check(t("core.language.it") === it["core.language.it"], "0.2 t() gives the Italian text");
setLanguage("en");
check(t("core.language.it") === en["core.language.it"], "0.2 t() gives the English text");

done("translation");
