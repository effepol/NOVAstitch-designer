// Module e's interface, ready for module 0's two hooks (Architect, 19/11): the
// preset card beside the fabric picker and the summary at export. Both are
// small, non-blocking and closable. The summary's data (exportSummary) uses
// module e's own data until module l's sheetData arrives: the preset's sheet
// and the notes for the special objects (cap frame, appliqué, foam, layered 3D,
// metallic thread).

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc } from "../../store";
import { setLanguage, t } from "../core/i18n";
import { registerStitchType } from "../core/stitchTypes";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject, StitchDocument } from "../../types";
import { loadPresets } from "./preset";
import { setPresetList } from "./registry";
import { exportSummary } from "./summary";
import { PresetCardView as PresetCard } from "./PresetCard";
import { ExportSummaryView as ExportSummary } from "./ExportSummary";
import anchors from "./anchors.json";

const dir = path.resolve(process.cwd(), "src/nova/presets/fabric");
setPresetList(loadPresets(Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(path.join(dir, f), "utf8")]))).presets);

const obj = (id: string, stitch: unknown): DesignObject => ({ id, name: id, thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths: [], stitch: stitch as DesignObject["stitch"] });
const doc = (over: Partial<StitchDocument> & { preset?: string; cap?: boolean } = {}): StitchDocument => ({
  ...emptyDoc(),
  ...over,
  nova: { schemaVersion: 1, fabricPreset: over.preset ? { id: over.preset, rev: 1 } : null, hoopKind: over.cap ? "cap" : "flat" },
});
const html = (el: unknown) => renderToStaticMarkup(el as never);

// ---- the data
setLanguage("it");
let s = exportSummary(doc({ preset: "spugna" }));
check(s.preset?.id === "spugna" && s.preset.topping === "water-soluble-film" && s.boxes.length === 0, "l.9 spugna: topping film idrosolubile, nessun riquadro");
s = exportSummary(doc({ preset: "cotone" }));
check(s.preset?.topping === "none" && s.preset.needlePoint === "normal", "l.9 cotone: nessun topping");
s = exportSummary(doc({ preset: "maglia" }));
check(s.needlePoint === "ballpoint", "l.13 maglia: ago a punta tonda");
check(exportSummary(doc({ preset: "cotone", cap: true })).boxes.includes("cap") && !exportSummary(doc({ preset: "cotone" })).boxes.includes("cap"), "l.8 telaio per cappelli: riquadro CAPPELLINO; telaio piano: assente");
check(exportSummary(doc()).preset === null, "nessun preset: nessuna scheda del tessuto");

const offFoam = registerStitchType({ id: "j.foam", module: "j", group: "line", label: () => "Schiuma", icon: null, matches: (st) => !!(st as { foam?: unknown }).foam, apply: (o) => o.stitch, Section: () => null });
const offLayer = registerStitchType({ id: "j.layered3d", module: "j", group: "fill", label: () => "3D a strati", icon: null, matches: (st) => !!(st as { layered3d?: unknown }).layered3d, apply: (o) => o.stitch, Section: () => null });
const special = doc({
  preset: "cotone",
  objects: [obj("ap", defaultStitch("applique")), obj("fo", { ...defaultStitch("satin"), foam: { passes: 1 } }), obj("la", { ...defaultStitch("fill"), layered3d: { layers: 6 } })],
  threads: [{ id: "t1", name: "Oro", color: "#c9a227", brand: "Madeira", code: "1", nova: { kind: "metallic" } } as never],
});
s = exportSummary(special);
check(["applique", "foam", "layered3d", "metallic"].every((b) => s.boxes.includes(b as never)), `l.10 / l.11 riquadri APPLIQUÉ, SCHIUMA 3D, 3D A STRATI, FILO METALLICO (${s.boxes.join(", ")})`);
check(s.needlePoint === "ballpoint", "con la schiuma: ago a punta tonda anche su cotone");
check(!exportSummary(doc({ preset: "cotone", objects: [obj("s", defaultStitch("satin"))] })).boxes.length, "un satin normale: nessun riquadro");

// ---- the summary at export: non-blocking, closable, in the program's language
let closed = 0;
let out = html(createElement(ExportSummary, { doc: special, onClose: () => closed++ }));
check(out.includes(t("e.summary.title")) && out.includes("Strappabile") && out.includes("SCHIUMA 3D") && out.includes("FILO METALLICO") && out.includes("siliconare il filo"), "il riepilogo in italiano: tessuto, schiuma, filo metallico con «siliconare il filo»");
check(out.includes('data-nova-anchor="e.exportSummary"') && out.includes('data-nova-anchor="e.exportSummary.close"') && !/role="dialog"|aria-modal/.test(out), "non bloccante (nessuna finestra modale) e chiudibile");
const visible = (h: string) => h.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ");
check(!/\d+\s*(min|h)\b|tempo stimato/i.test(visible(out)), "l.16 nessun tempo stimato");
setLanguage("en");
out = html(createElement(ExportSummary, { doc: special, onClose: () => closed++ }));
check(out.includes("FOAM 3D") && out.includes("METALLIC THREAD") && out.includes("Tear-away"), "l.18 the summary in English");

// ---- the preset card: compact, beside the picker, closable
setLanguage("it");
out = html(createElement(PresetCard, { doc: doc({ preset: "maglia" }), onClose: () => closed++ }));
check(out.includes("Maglia / Jersey") && out.includes("Da tagliare") && out.includes("medio") && out.includes("Nessuno") && out.includes("Tonda"), "la scheda di «maglia»: stabilizzatore da tagliare medio, topping nessuno, punta tonda");
check(out.includes("non si stirano"), "la scheda informativa del preset (testo, non regola)");
check(out.includes('data-nova-anchor="e.presetCard"') && out.includes('data-nova-anchor="e.presetCard.close"') && !/aria-modal/.test(out), "non bloccante e chiudibile");
check(html(createElement(PresetCard, { doc: doc(), onClose: () => closed++ })) === "", "nessun preset in vigore: la scheda non c'è");
offFoam();
offLayer();

// ---- anchors: every data-nova-anchor of the code is in anchors.json, and the other way round
const code = readdirSync(path.resolve(process.cwd(), "src/nova/presets")).filter((f) => f.endsWith(".tsx")).map((f) => readFileSync(path.resolve(process.cwd(), "src/nova/presets", f), "utf8")).join("\n");
const inCode = new Set([...code.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]));
const listed = new Set(Object.keys(anchors));
check([...inCode].every((a) => listed.has(a) && a.startsWith("e.")) && [...listed].every((a) => inCode.has(a)), `ancore del codice = anchors.json (${[...inCode].join(", ")})`);

done("module e interface");
