// Module l, the PDF: contract tests l.14, l.16, l.17, l.18, l.19 and what the
// page says for l.8, l.10–l.12 (the data are tested in sheetData.test.ts).

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { setLanguage } from "../core/i18n";
import { registerStitchType } from "../core/stitchTypes";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject } from "../../types";
import { layoutSheet, type Item } from "./layout";
import { sheetPdf } from "./pdf";
import { sheetData } from "./sheetData";
import { design, line, loadShippedPresets, planOf, thread } from "./testkit";
import it from "./it.json";
import en from "./en.json";

(async () => {
loadShippedPresets();
const texts = (pages: Item[][], page?: number) =>
  (page === undefined ? pages.flat() : pages[page])
    .filter((i): i is Extract<Item, { k: "text" }> => i.k === "text")
    .map((i) => i.text)
    .join("\n");
const sheetOf = (d: ReturnType<typeof design>, file = "ricamo.dst") => {
  const plan = planOf(d);
  return { plan, data: sheetData(d, plan, file) };
};
setLanguage("it");

// ---- l.14 100 × 80 mm: 1:1; 300 × 300 mm: reduced, its scale written
const box = (w: number, h: number) => design([line("a", "A", 10, w, 10), line("b", "A", 10 + h, w, 10)], [thread("A", "#cc0000")]);
let { plan, data } = sheetOf(box(100, 80));
let lay = layoutSheet(data, plan);
let stitches = lay.pages[0].find((i) => i.k === "stitches");
check(lay.previewScale === 1 && !!stitches && texts(lay.pages).includes("scala 1:1"), "l.14 disegno 100 × 80 mm: anteprima 1:1");
({ plan, data } = sheetOf(box(300, 300)));
lay = layoutSheet(data, plan);
check(lay.previewScale < 1 && lay.previewScale > 0.2, `l.14 disegno 300 × 300 mm: anteprima ridotta (${lay.previewScale.toFixed(3)})`);
check(new RegExp(`scala 1:${(1 / lay.previewScale).toFixed(2).replace(".", ",")} \\(${Math.round(lay.previewScale * 100)} %\\)`).test(texts(lay.pages)), "l.14 con la scala scritta");
stitches = lay.pages[0].find((i) => i.k === "stitches");
check(!!stitches && stitches.k === "stitches" && stitches.x >= 15 - 1e-9 && stitches.x + 300 * lay.previewScale <= 195 + 1e-9, "l'anteprima ridotta sta nei margini della pagina");

// ---- l.17 ten colours: one A4 page; sixty: a second page only for the rest of the table
const colours = (n: number) => {
  const ths = Array.from({ length: n }, (_, i) => thread(`T${i + 1}`, `#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}`));
  return design(
    ths.map((t, i) => line(`o${i}`, t.id, 10 + (i % 20) * 4, 30, 10 + Math.floor(i / 20) * 40)),
    ths,
  );
};
({ plan, data } = sheetOf(colours(10)));
lay = layoutSheet(data, plan);
check(lay.pages.length === 1 && lay.rowsPerPage[0] === 10, "l.17 10 colori: una pagina A4");
({ plan, data } = sheetOf(colours(60)));
lay = layoutSheet(data, plan);
const second = lay.pages[1] ?? [];
check(lay.pages.length === 2 && lay.rowsPerPage.reduce((a, b) => a + b, 0) === 60, `l.17 60 colori: due pagine (${lay.rowsPerPage.join(" + ")} righe)`);
check(!second.some((i) => i.k === "stitches") && texts([second]).includes("tabella colori (segue)") && !texts([second]).includes("Tessuto:"), "l.17 la seconda pagina è solo il seguito della tabella colori");
check(texts([second]).includes("Totale") && !texts([lay.pages[0]]).includes("Totale"), "i totali alla fine della tabella");
check(lay.rowsPerPage[0] > 5, "la prima pagina tiene anteprima e una parte della tabella");
const pdf60 = await PDFDocument.load(await sheetPdf(data, plan));
check(pdf60.getPageCount() === 2, "il PDF di 60 colori ha 2 pagine");
const [w, h] = [pdf60.getPage(0).getWidth(), pdf60.getPage(0).getHeight()];
check(Math.abs(w - 595.28) < 0.1 && Math.abs(h - 841.89) < 0.1, `pagine A4 (${w.toFixed(1)} × ${h.toFixed(1)} pt)`);

// ---- what page 1 says: the job, the table, the boxes
const offFoam = registerStitchType({ id: "j.foam", module: "j", group: "line", label: () => "Schiuma", icon: null, matches: (st) => !!(st as { foam?: unknown }).foam, apply: (o) => o.stitch, Section: () => null });
const offLayer = registerStitchType({ id: "j.layered3d", module: "j", group: "fill", label: () => "3D a strati", icon: null, matches: (st) => !!(st as { layered3d?: unknown }).layered3d, apply: (o) => o.stitch, Section: () => null });
const obj = (id: string, stitch: unknown): DesignObject => ({ ...line(id, "A", 10), stitch: stitch as DesignObject["stitch"], paths: [{ closed: true, nodes: [{ p: [10, 10] }, { p: [40, 10] }, { p: [40, 30] }, { p: [10, 30] }] }] });
const full = design(
  [obj("ap", defaultStitch("applique")), obj("fo", { ...defaultStitch("satin"), foam: { passes: 1 } }), obj("la", { ...defaultStitch("fill"), layered3d: { layers: 2 } }), line("m", "G", 50), line("f", "B", 60)],
  [thread("A", "#cc0000", { name: "Rosso" }), thread("G", "#c9a227", { name: "Oro", nova: { kind: "metallic" } }), thread("B", "#0000cc", { name: "Blu", weight: 60 })],
  { nova: { schemaVersion: 1, hoopKind: "cap", fabricPreset: { id: "spugna", rev: 1 } } },
);
({ plan, data } = sheetOf(full));
lay = layoutSheet(data, plan);
let all = texts(lay.pages);
check(["NOVAstitch Designer", "Scheda di lavoro", "ricamo.dst", "Spugna", "Film idrosolubile", "Telaio:", "Punti:", "Salti:", "Rasafili:", "Cambi colore:"].every((s) => all.includes(s)), "intestazione: nome, file, misure, conteggi, tessuto, topping, telaio");
check(lay.pages[0].some((i) => i.k === "logo"), "il logo a puntini");
check(["CAPPELLINO", "APPLIQUÉ", "Adesivo spray", "SCHIUMA 3D", "schiuma mai nel telaio", "3D A STRATI", "FILO METALLICO", "Ago apposito", "Siliconare il filo"].every((s) => all.includes(s)), "l.8 / l.10 / l.11 riquadri ben visibili con le loro note");
check(lay.pages[0].filter((i) => i.k === "rect" && i.stroke === "#CC1219").length === 5, "cinque riquadri con il bordo rosso");
check(all.includes("ago apposito") && all.includes("! 65/9") && all.includes("punta tonda"), "l.11 / l.12 riga metallica «ago apposito», riga del 60 segnalata «! 65/9»; schiuma: punta tonda");
check(!/densit/i.test(all), "l.11 nessun valore di densità");
check(all.includes(data.rows[0].topM.toFixed(2).replace(".", ",")) && all.includes(data.totals.bobbinM.toFixed(2).replace(".", ",")), "l.7 i metri della scheda sono quelli di sheetData");
check(lay.pages[0].some((i) => i.k === "text" && i.color === "#CC1219" && i.bold), "titoli rossi #CC1219");
offFoam();
offLayer();

// ---- l.16 no estimated time anywhere
const timeWords = /tempo|durata|\bmin\b|\bsec|\bore\b|time|duration|hours?\b/i;
check(!timeWords.test(all), "l.16 nessun tempo stimato nel PDF");

// ---- l.18 the program's language; every key in both catalogues
setLanguage("en");
all = texts(layoutSheet(data, plan).pages);
check(all.includes("Work sheet") && all.includes("METALLIC THREAD") && all.includes("Water-soluble film") && !all.includes("Scheda di lavoro"), "l.18 in English");
check(!timeWords.test(all), "l.16 no estimated time in English either");
setLanguage("it");
const keysIt = Object.keys(it).sort().join();
check(keysIt === Object.keys(en).sort().join() && Object.values({ ...it, ...en }).every((v) => typeof v === "string" && v.trim()), "l.18 ogni chiave nei due cataloghi");
// every key the code asks for is in the catalogues (dynamic keys by their prefix)
const dir = path.resolve(process.cwd(), "src/nova/worksheet");
const src = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
const asked = [...src.matchAll(/t\(\s*["`](l\.[^"`$]*)(\$\{)?/g)].map((m) => ({ key: m[1], dynamic: !!m[2] }));
const missing = asked.filter(({ key, dynamic }) => (dynamic ? !Object.keys(it).some((k) => k.startsWith(key)) : !(key in it)));
check(asked.length > 20 && missing.length === 0, `le chiavi usate dal codice sono nei cataloghi${missing.length ? `: mancano ${missing.map((m) => m.key).join(", ")}` : ""}`);

// ---- l.19 written straight to a file: no system print dialog, no browser print
const bytes = await sheetPdf(sheetData(box(100, 80), planOf(box(100, 80)), "x.dst"), planOf(box(100, 80)));
check(new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" && (await PDFDocument.load(bytes)).getPageCount() === 1, "l.19 i byte di un PDF valido, generati senza finestra di stampa");
check(!/window\.print|\.print\(\)|contentWindow|<iframe|printSheet\(/.test(src), "l.19 nessuna stampa del sistema nel codice del modulo");
// text the PDF fonts cannot write does not stop the sheet
const odd = design([line("a", "A", 10)], [thread("A", "#cc0000", { name: "赤い糸 ✂" })]);
check((await sheetPdf(sheetData(odd, planOf(odd), "x.dst"), planOf(odd))).length > 1000, "un nome di filo con caratteri che Courier non ha: il PDF si fa lo stesso");

done("module l PDF");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
