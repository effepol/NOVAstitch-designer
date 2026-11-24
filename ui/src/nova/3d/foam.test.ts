// Contract tests j.1 and j.2 (module j), the interface's part: the foam is a
// satin with its foam block (Architect, 24/11), switched on in the «Schiuma 3D»
// section of Filum's satin panel. The stitches themselves (density, contour,
// caps, stop) are checked by cargo test, crates/core/src/stitches/foam.rs.
// And module e's warning e.11 (stitches too close) is never given on a foam
// satin, which is denser on purpose; a normal satin keeps it. Module l's work
// sheet shows the SCHIUMA 3D box for it.

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultSatin } from "../../lib/geometry";
import { stitchFieldsFor, stitchTypeOf } from "../core/stitchTypes";
import { setLanguage, t } from "../core/i18n";
import type { DesignObject, StitchDocument } from "../../types";
import { installStitch3d } from "./install";
import { acceptsContourPasses, defaultFoam, FOAM_DENSITY_FACTOR, isFoam } from "./foam";
import { parsePreset } from "../presets/preset";
import { fabricIssues } from "../presets/issues";
import { sheetBoxes } from "../worksheet/sheetData";
import anchors from "./anchors.json";

const line: DesignObject["paths"] = [{ closed: false, nodes: [{ p: [0, 0] }, { p: [40, 0] }] }];
const obj = (stitch: DesignObject["stitch"]): DesignObject => ({ id: "s", name: "s", thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths: line, stitch });
const satin = { type: "satin" as const, ...defaultSatin(), width: 5, spacing: 0.4 };
const foamSatin = { ...satin, foam: defaultFoam() };

// the block
check(!isFoam(satin) && isFoam(foamSatin), "senza blocco foam: satin normale; con il blocco: schiuma");
check(foamSatin.foam.contourPasses === 1 && foamSatin.foam.caps, "default: 1 passata di contorno, cappucci attivi");
check(Math.abs(0.4 / foamSatin.foam.densityFactor - 0.28) < 0.01 && FOAM_DENSITY_FACTOR === 1.45, "j.1 densità × 1,45: 0,40 → 0,28 mm (provvisorio)");
check(acceptsContourPasses(1) && acceptsContourPasses(2) && !acceptsContourPasses(3) && !acceptsContourPasses(0), "j.2 passate di contorno: 1 o 2; 3 rifiutato");

// the section in Filum's satin panel
const off = installStitch3d();
check(stitchTypeOf(foamSatin) === null, "la schiuma non è un tipo di punto: resta un satin di Filum");
const fields = stitchFieldsFor("satin");
check(fields.length === 1 && fields[0].module === "j", "la sezione «Schiuma 3D» sta nel pannello del satin");
const html = (o: DesignObject, up: (p: Record<string, unknown>) => void = () => {}) =>
  renderToStaticMarkup(createElement(fields[0].Fields, { o, targets: [o.id], up, live: () => {}, begin: () => {} }));
setLanguage("it");
const off1 = html(obj(satin));
check(off1.includes("Schiuma 3D") && !off1.includes(t("j.foam.contourPasses")), "satin normale: solo l'interruttore «Schiuma 3D»");
const on = html(obj(foamSatin));
for (const k of ["j.foam.contourPasses", "j.foam.densityFactor", "j.foam.caps"]) check(on.includes(t(k)), `con la schiuma, nel pannello: ${t(k)}`);
for (const a of ["j.foam.section", "j.foam.on", "j.foam.contourPasses", "j.foam.caps"]) check(on.includes(`data-nova-anchor="${a}"`) && a in anchors, `ancora ${a}`);
check(on.includes("0.28"), "il pannello dice la distanza effettiva sulla schiuma (0,28 mm)");
check(t("j.foam.sheetNote").includes("punta tonda") && t("j.foam.sheetNote").includes("bambin"), "la nota per la scheda: ago a punta tonda, tensione più morbida, mai nel telaio, non per bambini");
check(html(obj({ type: "fill" } as never)) === "", "su un oggetto che non è un satin non mostra nulla");
off();
check(stitchFieldsFor("satin").length === 0, "install() si può togliere");

// module e's e.11 (Architect, 24/11): never on a satin with foam, as before on a normal satin
const stable = parsePreset("stabile.json", {
  id: "stabile", schemaVersion: 1, rev: 1, name: { it: "Prova", en: "Test" }, base: "cotton", elastic: false, overlap: { flat: 0.2, cap: 0.4 }, limits: { minSpacingRatio: 0.75 },
  info: { it: "Prova", en: "Test" }, stabilizer: { type: "tear-away", weight: "medium" }, topping: "none", needlePoint: "normal",
});
const docOf = (o: DesignObject): StitchDocument => ({ ...useStore.getState().doc, objects: [o], options: { ...useStore.getState().doc.options!, threadWeight: 40 }, nova: { schemaVersion: 1, fabricPreset: { id: "stabile", rev: 1 } } });
const dense = (st: DesignObject["stitch"]) => fabricIssues(docOf(obj(st)), null, stable).filter((i) => i.id.startsWith("e.dense:")).length;
check(dense({ ...satin, spacing: 0.15 }) === 1, "satin senza foam a 0,15 mm: avviso e.11 come prima");
check(dense({ ...foamSatin, spacing: 0.15 }) === 0, "satin con foam a 0,15 mm: nessun avviso e.11 (più fitto per scelta)");

// module l's work sheet (Architect, 24/11): the SCHIUMA 3D box for a satin with foam, none for a normal satin
check(sheetBoxes(docOf(obj(foamSatin))).includes("foam"), "satin con foam: riquadro SCHIUMA 3D nella scheda di lavoro");
check(!sheetBoxes(docOf(obj(satin))).includes("foam"), "satin senza foam: nessun riquadro SCHIUMA 3D");

done("j schiuma");
