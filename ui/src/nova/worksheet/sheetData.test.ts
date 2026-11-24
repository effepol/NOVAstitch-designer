// Module l, the work sheet's data (sheetData): contract tests l.1, l.2, l.7
// (data), l.8–l.13, l.15, on plans of the real engine.

import { check, done } from "../core/testkit";
import { registerStitchType } from "../core/stitchTypes";
import { defaultStitch } from "../../lib/geometry";
import { colorSequence } from "../../lib/threads";
import type { DesignObject } from "../../types";
import { NEEDLES, projectFileName, sheetData } from "./sheetData";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setLanguage } from "../core/i18n";
import { ExportSummaryView } from "../presets/ExportSummary";
import { exportSummary } from "../presets/summary";
import { metres } from "./format";
import { design, line, loadShippedPresets, planOf, thread } from "./testkit";

loadShippedPresets();
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---- l.1 three colours: three rows in sewing order, rows add up to the job
const three = design([line("o1", "A", 10), line("o2", "B", 30), line("o3", "C", 50)], [thread("A", "#cc0000"), thread("B", "#00aa00"), thread("C", "#0000cc")]);
const p3 = planOf(three);
let s = sheetData(three, p3, "ricamo.dst");
check(s.rows.length === 3 && s.rows.map((r) => r.thread.id).join() === "A,B,C" && s.rows.map((r) => r.n).join() === "1,2,3", "l.1 3 righe nell'ordine di cucitura");
check(s.totals.stitches === p3.stats.stitches && s.stitches === p3.stats.stitches && s.stitches > 0, `l.1 i punti delle righe sommati = punti del lavoro (${s.totals.stitches})`);
check(s.totals.trims === p3.stats.trims && s.trims === p3.stats.trims, `l.1 i rasafili delle righe sommati = rasafili del lavoro (${s.totals.trims})`);
check(s.colorChanges === 2 && s.jumps === p3.stats.jumps, "cambi colore e salti del lavoro");
check(near(s.width, p3.stats.width) && near(s.height, p3.stats.height) && s.width > 39, `larghezza × altezza dal piano (${s.width.toFixed(1)} × ${s.height.toFixed(1)})`);

// ---- l.2 colours A, B, A: three rows, A twice
const aba = design([line("o1", "A", 10), line("o2", "B", 30), line("o3", "A", 50)], [thread("A", "#cc0000"), thread("B", "#00aa00")]);
s = sheetData(aba, planOf(aba), "x.dst");
check(s.rows.length === 3 && s.rows[0].thread.id === "A" && s.rows[1].thread.id === "B" && s.rows[2].thread.id === "A", "l.2 3 righe; A compare due volte");

// ---- l.3 / l.6 (the formula is tested in the core) and l.7: the same metres everywhere
s = sheetData(three, p3, "ricamo.dst");
check(near(s.totals.topM, s.rows.reduce((a, r) => a + r.topM, 0)) && near(s.totals.bobbinM, s.rows.reduce((a, r) => a + r.bobbinM, 0)), "l.3 totali = somma delle righe");
check(s.rows.every((r) => r.bobbinM > 0 && r.topM > r.bobbinM), "superiore e spolina su ogni riga");
const seq = colorSequence(three, p3);
check(s.rows.every((r, i) => r.topM === seq[i].metres) && s.totals.topM === p3.stats.threadM && s.totals.bobbinM === p3.stats.bobbinM, "l.7 stessi metri della vista informazioni e delle statistiche del piano");
// the summary at export (module e's card) reads sheetData: the same metres, the same notes
const summary = exportSummary(three, p3);
check(summary.thread?.topM === s.totals.topM && summary.thread?.bobbinM === s.totals.bobbinM, "l.7 il riepilogo all'esportazione ha i metri della scheda");
setLanguage("it");
const card = renderToStaticMarkup(createElement(ExportSummaryView, { doc: three, plan: p3, onClose: () => {} }));
check(card.includes(`${metres(s.totals.topM, "it")} m superiore, ${metres(s.totals.bobbinM, "it")} m spolina`), `l.7 il riepilogo mostra ${metres(s.totals.topM, "it")} m / ${metres(s.totals.bobbinM, "it")} m`);
check(exportSummary(three).thread === null, "senza piano il riepilogo non scrive metri");
// one 40 mm line (plus its tie stitches): T = 1 (the cut at the colour change) on the first row
const r1 = s.rows[0];
const L1 = (r1.bobbinM * 1000 - 15) * 2;
check(L1 >= 40 && L1 < 52 && Math.abs(r1.topM * 1000 - ((L1 * 5) / 3 + 15)) < 1e-3, `l.6 riga 1: L = ${L1.toFixed(1)} mm, superiore 5/3·L + 15 mm, spolina 1/2·L + 15 mm`);

// ---- l.8 cap frame, then a flat hoop
check(sheetData({ ...three, nova: { schemaVersion: 1, hoopKind: "cap" } }, p3, "x").boxes.includes("cap") && sheetData({ ...three, nova: { schemaVersion: 1, hoopKind: "cap" } }, p3, "x").hoop.kind === "cap", "l.8 telaio per cappelli: riquadro CAPPELLINO");
check(!sheetData({ ...three, nova: { schemaVersion: 1, hoopKind: "flat" } }, p3, "x").boxes.includes("cap"), "l.8 telaio piano: niente riquadro");
check(sheetData(three, p3, "x").hoop.name === three.hoop.name, "telaio del lavoro");

// ---- l.9 towel, then cotton
const withPreset = (id: string) => ({ ...three, nova: { schemaVersion: 1, fabricPreset: { id, rev: 1 } } });
s = sheetData(withPreset("spugna"), p3, "x");
check(s.preset?.topping === "water-soluble-film", "l.9 spugna: topping film idrosolubile");
s = sheetData(withPreset("cotone"), p3, "x");
check(s.preset?.topping === "none" && !!s.preset.stabilizer.type, "l.9 cotone: nessun topping; stabilizzatore dal preset");

// ---- l.10 appliqué, foam, layered 3D (module j's types through module 0's registry)
const offFoam = registerStitchType({ id: "j.foam", module: "j", group: "line", label: () => "Schiuma", icon: null, matches: (st) => !!(st as { foam?: unknown }).foam, apply: (o) => o.stitch, Section: () => null });
const offLayer = registerStitchType({ id: "j.layered3d", module: "j", group: "fill", label: () => "3D a strati", icon: null, matches: (st) => !!(st as { layered3d?: unknown }).layered3d, apply: (o) => o.stitch, Section: () => null });
const obj = (id: string, stitch: unknown): DesignObject => ({ ...line(id, "A", 10), stitch: stitch as DesignObject["stitch"] });
const special = design([obj("ap", defaultStitch("applique")), obj("fo", { ...defaultStitch("satin"), foam: { passes: 1 } }), obj("la", { ...defaultStitch("fill"), layered3d: { layers: 2 } })], [thread("A", "#cc0000")]);
s = sheetData(special, null, "x");
check(["applique", "foam", "layered3d"].every((b) => s.boxes.includes(b as never)), `l.10 riquadri APPLIQUÉ, SCHIUMA 3D, 3D A STRATI (${s.boxes.join(", ")})`);
check(s.needlePoint === "ballpoint", "con la schiuma: punta tonda");
const hidden = design([{ ...obj("ap", defaultStitch("applique")), visible: false }], [thread("A", "#cc0000")]);
check(!sheetData(hidden, null, "x").boxes.length, "un oggetto nascosto non si cuce: nessun riquadro");
offFoam();
offLayer();

// ---- l.11 a metallic colour
const metal = design([line("o1", "A", 10), line("o2", "G", 30)], [thread("A", "#cc0000"), thread("G", "#c9a227", { nova: { kind: "metallic" } })]);
s = sheetData(metal, planOf(metal), "x");
check(s.boxes.includes("metallic"), "l.11 riquadro FILO METALLICO");
check(s.rows[1].kind === "metallic" && s.rows[1].needle.size === null && s.rows[1].needleDiffers, "l.11 la riga metallica: ago apposito, senza misura");
check(s.jobNeedle.size === "65/9–75/11", "l.11 l'ago del lavoro viene dai fili standard");
check(!("density" in s.rows[1]), "l.11 nessun valore di densità");
const allMetal = design([line("o1", "G", 10)], [thread("G", "#c9a227", { nova: { kind: "metallic" } })]);
check(sheetData(allMetal, planOf(allMetal), "x").jobNeedle.size === null, "solo filo metallico: ago apposito anche per il lavoro");
check(!sheetData(design([line("o1", "A", 10)], [thread("A", "#cc0000"), thread("G", "#c9a227", { nova: { kind: "metallic" } })]), null, "x").boxes.includes("metallic"), "un filo metallico non usato: nessun riquadro");

// ---- l.12 weight 60 on one colour, 40 on the others
const fine = design([line("o1", "A", 10), line("o2", "B", 30), line("o3", "C", 50)], [thread("A", "#cc0000"), thread("B", "#00aa00", { weight: 60 }), thread("C", "#0000cc")]);
s = sheetData(fine, planOf(fine), "x");
check(s.rows.map((r) => r.weight).join() === "40,60,40", "l.12 colonna titolo con i due valori");
check(s.jobNeedle.size === "65/9–75/11", "l.12 ago del lavoro 65/9–75/11 (quello del 40)");
check(s.rows[1].needle.size === "65/9" && s.rows[1].needleDiffers && !s.rows[0].needleDiffers && !s.rows[2].needleDiffers, "l.12 la riga del 60 segnala l'ago 65/9");
// the heaviest thread decides the job's needle; the book's table
const heavy = design([line("o1", "A", 10), line("o2", "B", 30)], [thread("A", "#cc0000"), thread("B", "#00aa00", { weight: 12 })]);
s = sheetData(heavy, planOf(heavy), "x");
check(s.jobNeedle.size === "100/16" && s.jobNeedle.note === "topTensionOnly" && s.rows[0].needleDiffers, "filo 12: ago 100/16 per il lavoro, nota Burmilana; la riga del 40 lo segnala");
check(NEEDLES[30].size === "75/11" && NEEDLES[40].size === "65/9–75/11" && NEEDLES[60].size === "65/9" && NEEDLES[12].size === "100/16", "tabella degli aghi del libro");
check(sheetData({ ...three, options: { ...three.options, threadWeight: 60 } as typeof three.options }, p3, "x").rows.every((r) => r.weight === 60), "titolo del disegno quando il filo non ha il suo");

// ---- l.13 knit preset
check(sheetData(withPreset("maglia"), p3, "x").needlePoint === "ballpoint" && sheetData(withPreset("cotone"), p3, "x").needlePoint === "normal", "l.13 maglia: punta tonda; cotone: normale");

// ---- l.15 the stitch file's name
check(sheetData(three, p3, "ricamo.dst").fileName === "ricamo.dst", "l.15 con l'esportazione: «ricamo.dst»");
check(projectFileName(three, "/lavori/progetto.nsd") === "progetto.nsd" && projectFileName(three, "C:\\lavori\\progetto.nsd") === "progetto.nsd", "l.15 dal menu: «progetto.nsd»");
check(projectFileName(three, null) === "progetto.nsd" && projectFileName(three, "/lavori/progetto.filum") === "progetto.nsd", "mai salvato, o aperto da un .filum: il nome del .nsd che avrà");

// ---- no plan yet: the summary's data still there
s = sheetData(withPreset("maglia"), null, "x");
check(s.rows.length === 0 && s.preset?.id === "maglia" && s.needlePoint === "ballpoint", "senza piano: tessuto, preset e riquadri, nessuna riga");

done("module l sheetData");
