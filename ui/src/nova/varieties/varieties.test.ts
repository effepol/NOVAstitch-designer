// Contract tests n.11–n.16 (module n, varieties), the interface's part. The
// stitches themselves (n.1–n.10) are checked by cargo test,
// crates/core/src/stitches/variety.rs.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Ajv2020 from "ajv/dist/2020";
import { useStore } from "../../store";
import { runCommand } from "../core/commands";
import { setModeSource } from "../core/mode";
import { setLanguage, t } from "../core/i18n";
import { defaultStitch, rectPath } from "../../lib/geometry";
import type { DesignObject, FillParams, SatinParams, StitchDocument } from "../../types";
import { planOf } from "../worksheet/testkit";
import { readProject } from "../format/read";
import { nsdText } from "../format/serialize";
import { installPresetCommands } from "../presets/commands";
import { parsePreset } from "../presets/preset";
import { setPresetList } from "../presets/registry";
import { reloadVarieties, setSources } from "./load";
import { installVarieties } from "./install";
import { SET_COMMAND, VarietyFields } from "./Panel";
import { thumbnail, thumbnailCount } from "./thumbs";
import {
  LONG_SHORT_LENGTHS,
  LONG_SHORT_OFFSETS,
  NORMAL_ID,
  RANDOM_LENGTHS,
  RANDOM_OFFSETS,
  bisatinPatch,
  kindOf,
  loadVarieties,
  parseVariety,
  randomPatch,
  varietyById,
  varietyInUse,
  varietyList,
  varietyPatch,
  type FolderReader,
} from "./varieties";
import it from "./it.json";
import en from "./en.json";
import anchors from "./anchors.json";

const here = path.resolve(process.cwd(), "src/nova/varieties");
const libDir = path.join(here, "library");
const shipped = Object.fromEntries(readdirSync(libDir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(path.join(libDir, f), "utf8")]));

(async () => {
  setLanguage("it");

  // ---- n.13: the library
  const user: Record<string, string> = {
    "rotto.json": "{ non è JSON",
    "senza-inglese.json": JSON.stringify({ id: "x", name: { it: "X" }, type: "tatami", values: { lengthPattern: [3] } }),
    "tipo-sbagliato.json": JSON.stringify({ id: "y", name: { it: "Y", en: "Y" }, type: "running", values: { lengthPattern: [3] } }),
    "campo-estraneo.json": JSON.stringify({ id: "z", name: { it: "Z", en: "Z" }, type: "tatami", values: { splitLengthPattern: [3] } }),
    "leggimi.txt": "non una varietà",
  };
  const folder = (files: Record<string, string>): FolderReader => ({
    list: async (dir) => (dir === "varieta" ? Object.keys(files).map((name) => ({ name, isDirectory: false })) : null),
    read: async (f) => files[f.replace(/^varieta\//, "")],
  });
  setSources(shipped, folder(user));
  let threw = false;
  try {
    await reloadVarieties();
  } catch {
    threw = true;
  }
  const lc = varietyById("lungo-corto-tatami");
  const ls = varietyById("lungo-corto-satin");
  check(!!lc && lc.name.it === "Lungo-corto" && lc.name.en === "Long-short" && lc.type === "tatami", "n.13 Lungo-corto tatami incluso, con nome IT/EN");
  check(!!ls && ls.type === "satin" && ls.name.it === "Lungo-corto", "n.13 Lungo-corto satin incluso");
  check(!threw && varietyList().length === 2, `n.13 i file non validi della cartella utente sono saltati senza errore (${varietyList().map((v) => v.id).join(", ")})`);
  user["mia.json"] = JSON.stringify({ id: "mia", name: { it: "La mia", en: "Mine" }, type: "tatami", values: { lengthPattern: [3, 3, 1.5] } });
  await reloadVarieties();
  check(varietyById("mia")?.user === true && varietyList("tatami").length === 2, "n.13 un file aggiunto nella cartella diventa una voce");
  check(parseVariety(JSON.stringify({ id: "normale", name: { it: "N", en: "N" }, type: "tatami", values: { lengthPattern: [3] } })) === null, "n.13 «normale» è riservato");
  check(loadVarieties({ "a.json": shipped["lungo-corto-tatami.json"], "b.json": shipped["lungo-corto-tatami.json"] }).length === 1, "n.13 un id ripetuto è saltato");
  // the provisional values, the same in the files and in the constants
  check(JSON.stringify(lc?.values) === JSON.stringify({ lengthPattern: LONG_SHORT_LENGTHS, offsetPattern: LONG_SHORT_OFFSETS }), "valori provvisori del Lungo-corto (tatami) uguali alle costanti");
  check(JSON.stringify(ls?.values) === JSON.stringify({ splitLengthPattern: LONG_SHORT_LENGTHS, splitOffsetPattern: LONG_SHORT_OFFSETS }), "valori provvisori del Lungo-corto (satin) uguali alle costanti");
  check(JSON.stringify(RANDOM_LENGTHS) === "[2.5,4.5]" && JSON.stringify(RANDOM_OFFSETS) === "[0,1]", "valori provvisori del Casuale: 2,5–4,5 mm e 0–1");

  // ---- n.14: applying a variety
  const presetFile = (id: string, fill: Record<string, unknown>) =>
    parsePreset(`${id}.json`, { schemaVersion: 1, id, rev: 1, name: { it: id, en: id }, base: "cotton", elastic: false, overlap: { flat: 0.2, cap: 0.4 }, limits: { minSpacingRatio: 0.75 }, info: { it: "-", en: "-" }, stabilizer: { type: "tear-away", weight: "medium" }, topping: "none", needlePoint: "normal", fill, satin: { pullComp: 0.2 } });
  setPresetList([presetFile("a", { underlaySpacing: 0.8, pullComp: 0.3, underlay: true }), presetFile("b", { underlaySpacing: 1, pullComp: 0.5, underlay: false })]);
  const offPresets = installPresetCommands();
  const offN = installVarieties();
  const st = () => useStore.getState();
  const obj = (id: string, stitch: DesignObject["stitch"], paths = [rectPath(0, 0, 20, 20)]): DesignObject => ({ id, name: id, thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch });
  const satinLine = (id: string, over: Partial<SatinParams> = {}) => obj(id, { ...defaultStitch("satin"), width: 6, ...over } as DesignObject["stitch"], [{ closed: false, nodes: [{ p: [0, 50] }, { p: [30, 50] }] }]);
  const load = (objects: DesignObject[]) => st().setDoc({ ...st().doc, objects, fabric: "cotton", nova: { schemaVersion: 1, fabricPreset: { id: "a", rev: 1 } } }, { history: false });
  const get = (id: string) => st().doc.objects.find((o) => o.id === id)!;
  const fill = (id: string) => get(id).stitch as { type: "fill" } & FillParams;
  const satin = (id: string) => get(id).stitch as { type: "satin" } & SatinParams;

  setModeSource(() => "assisted");
  load([obj("t", { ...defaultStitch("fill"), rowSpacing: 0.3, pullComp: 0.3, underlay: true } as DesignObject["stitch"]), satinLine("s")]);
  const before = fill("t");
  const past = st().past.length;
  runCommand(SET_COMMAND, { ids: ["t"], patch: varietyPatch("tatami", lc!) });
  const after = fill("t");
  check(st().past.length === past + 1, "n.14 applicare una varietà: un solo passo di Annulla");
  check(JSON.stringify(after.lengthPattern) === "[4,2]" && JSON.stringify(after.offsetPattern) === JSON.stringify(LONG_SHORT_OFFSETS), "n.14 i valori della varietà sono nell'oggetto");
  check(after.rowSpacing === before.rowSpacing && after.pullComp === before.pullComp && after.underlay === before.underlay && after.maxStitchLength === before.maxStitchLength, "n.14 densità, compensazione e sottopunti invariati");
  const edited = get("t").nova?.edited ?? [];
  check(edited.includes("stitch.lengthPattern") && edited.includes("stitch.offsetPattern"), `n.14 i campi sono in nova.edited anche in Assistito (${JSON.stringify(edited)})`);
  check(varietyInUse(get("t").stitch, "tatami") === "lungo-corto-tatami", "la varietà in uso è riconosciuta");
  runCommand("e.preset.apply", { presetId: "b" });
  check(JSON.stringify(fill("t").lengthPattern) === "[4,2]" && fill("t").pullComp === 0.5 && fill("t").underlay === false, "n.14 un cambio di tessuto conserva la varietà (e mette i suoi valori)");
  st().undo();
  st().undo();
  check(fill("t").lengthPattern === undefined && fill("t").pullComp === 0.3, "n.14 un Annulla toglie la varietà");
  // Normale takes the fields away; Casuale and Bisatin are switches
  runCommand(SET_COMMAND, { ids: ["t"], patch: varietyPatch("tatami", lc!) });
  runCommand(SET_COMMAND, { ids: ["t"], patch: varietyPatch("tatami", null) });
  check(!("lengthPattern" in fill("t")) && !("offsetPattern" in fill("t")) && varietyInUse(get("t").stitch, "tatami") === NORMAL_ID, "Normale toglie i campi");
  runCommand(SET_COMMAND, { ids: ["t"], patch: randomPatch("tatami", true, RANDOM_LENGTHS, RANDOM_OFFSETS, 7) });
  check(JSON.stringify(fill("t").lengthRange) === "[2.5,4.5]" && JSON.stringify(fill("t").offsetRange) === "[0,1]" && fill("t").seed === 7, "Casuale acceso: intervalli e seme");
  runCommand(SET_COMMAND, { ids: ["t"], patch: randomPatch("tatami", false) });
  check(!("lengthRange" in fill("t")) && !("offsetRange" in fill("t")), "Casuale spento: intervalli tolti");
  runCommand(SET_COMMAND, { ids: ["s"], patch: bisatinPatch(true) });
  check(satin("s").bisatin === true, "Bisatin acceso sul satin");
  runCommand(SET_COMMAND, { ids: ["s"], patch: bisatinPatch(false) });
  check(!("bisatin" in satin("s")), "Bisatin spento: campo tolto");
  runCommand(SET_COMMAND, { ids: ["t"], patch: bisatinPatch(true) });
  check(!("bisatin" in fill("t")), "il tatami non prende il bisatin");

  // ---- n.11: not on a satin over foam
  load([satinLine("f", { foam: { contourPasses: 1, densityFactor: 1.45, caps: true } })]);
  const foamPast = st().past.length;
  runCommand(SET_COMMAND, { ids: ["f"], patch: { ...bisatinPatch(true), ...varietyPatch("satin", ls!) } });
  check(kindOf(get("f").stitch) === null && !("bisatin" in satin("f")) && !("splitLengthPattern" in satin("f")) && st().past.length === foamPast, "n.11 sul satin con schiuma niente bisatin né varietà (nessun passo di annulla)");
  const props = { o: get("f"), targets: ["f"], up: () => {}, live: () => {}, begin: () => {} };
  const foamHtml = renderToStaticMarkup(createElement(VarietyFields, props));
  check(foamHtml.includes(t("n.foam")) && !foamHtml.includes("n.bisatin") && !foamHtml.includes('data-nova-anchor="n.list"'), "n.11 il pannello del satin con schiuma non offre Bisatin né l'elenco");

  // ---- n.12: the schema takes the fields; a .nsd saved and opened again keeps them (6 decimals)
  load([
    obj("t", { ...defaultStitch("fill"), lengthPattern: [4, 2], offsetPattern: [0, 1 / 3, 2 / 3], lengthRange: [2.5, 4.5], offsetRange: [0, 1] } as DesignObject["stitch"]),
    satinLine("s", { splitLengthPattern: [4, 2], splitOffsetPattern: [0, 1 / 3, 2 / 3], splitLengthRange: [2.5, 4.5], splitOffsetRange: [0.1, 0.9], bisatin: true }),
  ]);
  const text = nsdText(st().doc);
  check(text.includes("0.333333") && !text.includes("0.3333333"), "n.12 al massimo 6 decimali");
  const back = readProject("prova.nsd", new TextEncoder().encode(text)).doc as StitchDocument;
  const bt = back.objects[0].stitch as FillParams;
  const bs = back.objects[1].stitch as SatinParams;
  check(JSON.stringify(bt.offsetPattern) === "[0,0.333333,0.666667]" && JSON.stringify(bt.lengthRange) === "[2.5,4.5]" && JSON.stringify(bt.offsetRange) === "[0,1]", "n.12 il tatami riaperto conserva i campi");
  check(JSON.stringify(bs.splitLengthPattern) === "[4,2]" && JSON.stringify(bs.splitOffsetRange) === "[0.1,0.9]" && bs.bisatin === true, "n.12 il satin riaperto conserva i campi");
  const schemaDir = path.resolve(process.cwd(), "..", "schema");
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  ajv.addSchema(JSON.parse(readFileSync(path.join(schemaDir, "filum-core.schema.json"), "utf8")));
  const validate = ajv.compile(JSON.parse(readFileSync(path.join(schemaDir, "nsd.schema.json"), "utf8")));
  check(!!validate(JSON.parse(text)), `n.12 lo schema accetta i campi nuovi ${validate.errors ? ajv.errorsText(validate.errors).slice(0, 300) : ""}`);

  // ---- n.15: the pictures, made by the core and kept
  let calls = 0;
  const plan = (d: StitchDocument) => {
    calls++;
    return planOf(d);
  };
  const normalT = await thumbnail(NORMAL_ID, "tatami", varietyPatch("tatami", null), plan);
  const lcT = await thumbnail(lc!.id, "tatami", varietyPatch("tatami", lc!), plan);
  const normalS = await thumbnail(NORMAL_ID, "satin", varietyPatch("satin", null), plan);
  const lcS = await thumbnail(ls!.id, "satin", varietyPatch("satin", ls!), plan);
  check(normalT.startsWith("<svg") && normalT.includes("<path") && normalT.length > 200, "n.15 la miniatura è un'immagine dei punti");
  check(normalT !== lcT, "n.15 tatami: Normale e Lungo-corto danno immagini diverse");
  check(normalS !== lcS, "n.15 satin: Normale e Lungo-corto danno immagini diverse");
  await thumbnail(lc!.id, "tatami", varietyPatch("tatami", lc!), plan);
  check(calls === 4 && thumbnailCount() === 4, `n.15 tenute in memoria: il core è chiamato una volta per varietà (${calls})`);

  // ---- n.16: texts IT/EN, anchors n.*
  const keysIt = Object.keys(it).sort();
  const keysEn = Object.keys(en).sort();
  check(JSON.stringify(keysIt) === JSON.stringify(keysEn) && keysIt.every((k) => k.startsWith("n.")), "n.16 le stesse chiavi n.* in it.json ed en.json");
  check(keysIt.every((k) => (it as Record<string, string>)[k].trim() && (en as Record<string, string>)[k].trim()), "n.16 nessun testo vuoto");
  const src = readdirSync(here).filter((f) => f.endsWith(".tsx") || (f.endsWith(".ts") && !f.endsWith(".test.ts"))).map((f) => readFileSync(path.join(here, f), "utf8")).join("\n");
  const used = [...src.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]);
  check(used.length > 0 && used.every((a) => a.startsWith("n.") && a in anchors), `n.16 ogni ancora n.* è in anchors.json (${used.join(", ")})`);
  check(Object.keys(anchors).every((a) => used.includes(a)), "n.16 ogni ancora di anchors.json è usata");
  const keysUsed = [...src.matchAll(/t\("(n\.[A-Za-z0-9.]+)"/g)].map((m) => m[1]);
  check(keysUsed.every((k) => k in it), `n.16 ogni t("n.…") ha il suo testo (${keysUsed.filter((k) => !(k in it)).join(", ")})`);
  // the panel in both languages
  load([obj("t", defaultStitch("fill")), satinLine("s")]);
  for (const lang of ["it", "en"] as const) {
    setLanguage(lang);
    const tat = renderToStaticMarkup(createElement(VarietyFields, { ...props, o: get("t"), targets: ["t"] }));
    const sat = renderToStaticMarkup(createElement(VarietyFields, { ...props, o: get("s"), targets: ["s"] }));
    const cat = lang === "it" ? it : en;
    check(tat.includes(cat["n.title"]) && tat.includes(cat["n.normal"]) && tat.includes(lang === "it" ? "Lungo-corto" : "Long-short") && tat.includes(cat["n.random"]) && !tat.includes(cat["n.bisatin"]), `n.16 pannello tatami in ${lang}: Varietà, Normale, Lungo-corto, Casuale`);
    check(sat.includes(cat["n.bisatin"]) && /aria-selected="true"[^>]*>.*?/.test(sat), `n.16 pannello satin in ${lang}: Bisatin, la voce in uso evidenziata`);
  }

  offN();
  offPresets();
  done("n varietà (interfaccia)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
