// Modulo i — controlli statici dei cataloghi di Filum (parte di i.1 e di i.3).
//   - ogni chiave usata nei file di Filum esiste in it.json ed en.json, con testo non vuoto;
//   - le due lingue hanno le stesse chiavi, tutte "filum.<area>.<chiave>", e nessuna è inutilizzata;
//   - i segnaposto {nome} sono gli stessi nelle due lingue;
//   - i.1: l'italiano è diverso dall'inglese, salvo i testi di non-tradurre.json;
//   - i.3: l'inglese è identico, carattere per carattere, al testo di Filum 0.2.1 (origine-0.2.1.json).

import { check, done } from "../../core/testkit";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ui = process.cwd();
const src = path.join(ui, "src");
const here = path.join(src, "nova", "i18n", "filum");
const read = (f: string) => JSON.parse(readFileSync(path.join(here, f), "utf8"));

const it: Record<string, string> = read("it.json");
const en: Record<string, string> = read("en.json");
const origine: Record<string, { testo: string; file: string }> = read("origine-0.2.1.json");
const allowed = new Set(Object.keys(read("non-tradurre.json").testi));
const prefissi = Object.keys(read("chiavi-dinamiche.json").prefissi);
const aree = read("aree.json").aree as Record<string, { fatta: boolean; file: string[] }>;

// --- le chiavi usate nei file di Filum: t("filum.…") e tn("filum.…", n) -------
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return dir === src && f === "nova" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) && !/\.(test|d)\.ts$/.test(f) ? [p] : [];
  });
export const keysIn = (text: string): string[] =>
  [...text.matchAll(/\b(tn?)\(\s*["'`](filum\.[A-Za-z0-9_.-]+)["'`]/g)].flatMap((m) => (m[1] === "tn" ? [`${m[2]}.one`, `${m[2]}.other`] : [m[2]]));
check(keysIn(`t("filum.a.b"); tn('filum.c.d', n); t("core.x"); t(\`filum.e.\${x}\`)`).join() === "filum.a.b,filum.c.d.one,filum.c.d.other", "i la ricerca trova t(\"filum.…\") e tn(\"filum.…\")");

const used = new Set<string>();
for (const f of walk(src)) for (const k of keysIn(readFileSync(f, "utf8"))) used.add(k);

const empty = (v: unknown) => typeof v !== "string" || !v.trim();
const missing = [...used].filter((k) => empty(it[k]) || empty(en[k]));
check(!missing.length, `i ogni chiave usata ha un testo italiano e uno inglese (${used.size} chiavi; mancano: ${missing.slice(0, 20).join(", ") || "nessuna"})`);

// --- i due cataloghi -----------------------------------------------------------
const onlyIt = Object.keys(it).filter((k) => !(k in en));
const onlyEn = Object.keys(en).filter((k) => !(k in it));
check(!onlyIt.length && !onlyEn.length, `i it.json ed en.json hanno le stesse chiavi (solo it: ${onlyIt.join(", ") || "nessuna"}; solo en: ${onlyEn.join(", ") || "nessuna"})`);
// filum.app.name: il nome del programma, chiave unica fissata dall'Architetto (non è un'area)
const badName = Object.keys(en).filter((k) => k !== "filum.app.name" && (!/^filum\.[a-z]+\.[A-Za-z0-9_.-]+$/.test(k) || !(k.split(".")[1] in aree)));
check(!badName.length, `i ogni chiave è "filum.<area>.<chiave>" con un'area di aree.json (fuori regola: ${badName.slice(0, 20).join(", ") || "nessuna"})`);
const blank = Object.keys(en).filter((k) => empty(en[k]) || empty(it[k]));
check(!blank.length, `i nessun testo vuoto (${blank.slice(0, 20).join(", ") || "nessuno"})`);
const unused = Object.keys(en).filter((k) => !used.has(k) && !prefissi.some((p) => k.startsWith(p)));
check(!unused.length, `i nessuna chiave inutilizzata (${unused.slice(0, 20).join(", ") || "nessuna"})`);

const holes = (s: string) => [...(s ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const badHoles = Object.keys(en).filter((k) => k in it && holes(it[k]) !== holes(en[k]));
check(!badHoles.length, `i i segnaposto {…} sono gli stessi nelle due lingue (diversi: ${badHoles.slice(0, 20).join(", ") || "nessuno"})`);

// --- i.1 (statico): l'italiano non è l'inglese --------------------------------
// un testo fatto solo di segnaposto e segni ("{name}{unsaved} — {app}") non ha parole da tradurre
// e le parole di non-tradurre.json («mm», «Zoom») non contano: «{v1} × {v2} mm», «Zoom {z}×»
const words = (s: string) => (s.replace(/\{\w+\}/g, " ").match(/\p{L}+/gu) ?? []).some((w) => !allowed.has(w));
const same = Object.keys(en).filter((k) => it[k] === en[k] && words(en[k]) && !allowed.has(en[k].trim()));
check(!same.length, `i.1 nessun testo italiano è rimasto in inglese (${same.slice(0, 20).map((k) => `${k}="${en[k]}"`).join(", ") || "nessuno"})`);

// --- i.3 (statico): l'inglese è quello di Filum 0.2.1 --------------------------
// Il nome del programma (filum.app.name) è l'unica chiave esclusa; negli altri testi {app} vale il nome di Filum 0.2.1.
const APP = "filum.app.name";
check(APP in en && APP in origine, "i.3 il nome del programma sta nella chiave filum.app.name");
const oldName = origine[APP]?.testo ?? "Filum";
const changed = Object.keys(en).filter((k) => k !== APP && origine[k]?.testo !== en[k].replaceAll("{app}", oldName));
check(!changed.length, `i.3 ogni testo inglese è identico a Filum 0.2.1, salvo filum.app.name (diversi o senza origine: ${changed.slice(0, 20).join(", ") || "nessuno"})`);
// testi che nominano Filum di proposito (finestra Informazioni): non-tradurre.json, chiavi_con_filum
const literal = new Set(Object.keys(read("non-tradurre.json").chiavi_con_filum ?? {}));
const named = Object.keys(en).filter((k) => k !== APP && !literal.has(k) && en[k].includes(oldName));
check(!named.length, `i il nome del programma nei testi è {app}, non scritto (${named.slice(0, 20).join(", ") || "nessuno"})`);
const lost = Object.keys(origine).filter((k) => !(k in en));
check(!lost.length, `i.3 ogni testo di Filum 0.2.1 estratto è nel catalogo (persi: ${lost.slice(0, 20).join(", ") || "nessuno"})`);

// --- le aree: ogni file di Filum in una sola area -------------------------------
const files = walk(src).map((p) => path.relative(src, p).split(path.sep).join("/"));
const owners = new Map<string, string[]>();
for (const [name, a] of Object.entries(aree)) for (const f of a.file) owners.set(f, [...(owners.get(f) ?? []), name]);
const twice = [...owners].filter(([, o]) => o.length > 1).map(([f]) => f);
check(!twice.length, `i nessun file sta in due aree (${twice.join(", ") || "nessuno"})`);
const gone = [...owners.keys()].filter((f) => !files.includes(f));
check(!gone.length, `i i file di aree.json esistono (${gone.join(", ") || "tutti"})`);

done("traduzione di Filum: cataloghi");
