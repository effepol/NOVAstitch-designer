// Contract tests j.1 and j.2 (module j), the interface's part: the foam stitch
// type in Filum's picker and panel. The stitches themselves (density, contour,
// caps, stop) are checked by cargo test, crates/core/src/stitches/foam.rs.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultSatin } from "../../lib/geometry";
import { stitchTypeOf } from "../core/stitchTypes";
import { setLanguage, t } from "../core/i18n";
import type { DesignObject, FoamParams } from "../../types";
import { installStitch3d } from "./install";
import { acceptsContourPasses, FOAM_DENSITY_FACTOR, toFoam } from "./foam";
import anchors from "./anchors.json";

const obj = (stitch: unknown, paths: DesignObject["paths"] = [{ closed: false, nodes: [{ p: [0, 0] }, { p: [40, 0] }] }]): DesignObject => ({ id: "f", name: "f", thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch: stitch as DesignObject["stitch"] });

// from a satin: its own values stay, the foam's defaults join them
const satin = { type: "satin" as const, ...defaultSatin(), width: 5, spacing: 0.4 };
const f = toFoam(obj(satin)) as { type: "foam" } & FoamParams;
check(f.type === "foam" && f.width === 5 && f.spacing === 0.4, "la colonna satin diventa schiuma con la sua larghezza e densità");
check(f.contourPasses === 1 && f.caps === true, "default: 1 passata di contorno, cappucci attivi");
check(Math.abs(0.4 / f.densityFactor - 0.28) < 0.01 && FOAM_DENSITY_FACTOR === 1.45, "j.1 densità × 1,45: 0,40 → 0,28 mm (provvisorio)");
check(acceptsContourPasses(1) && acceptsContourPasses(2) && !acceptsContourPasses(3) && !acceptsContourPasses(0), "j.2 passate di contorno: 1 o 2; 3 rifiutato");

const off = installStitch3d();
check(stitchTypeOf(f)?.id === "j.foam" && stitchTypeOf(satin) === null, "la schiuma è il tipo j.foam (letto anche dai moduli e ed l); il satin resta di Filum");
const entry = stitchTypeOf(f)!;
check(entry.group === "line", "la scheda sta con le linee, accanto al satin");
setLanguage("it");
check(entry.label() === "Satin su schiuma 3D", "nome in italiano");
const html = renderToStaticMarkup(createElement(entry.Section, { o: obj(f), targets: ["f"], up: () => {}, live: () => {}, begin: () => {} }));
for (const k of ["j.foam.width", "j.foam.contourPasses", "j.foam.caps"]) check(html.includes(t(k)), `nel pannello: ${t(k)}`);
for (const a of ["j.foam.section", "j.foam.contourPasses", "j.foam.caps"]) check(html.includes(`data-nova-anchor="${a}"`) && a in anchors, `ancora ${a}`);
check(t("j.foam.sheetNote").includes("punta tonda") && t("j.foam.sheetNote").includes("bambin"), "la nota per la scheda: ago a punta tonda, tensione più morbida, mai nel telaio, non per bambini");
check(html.includes("0.28"), "il pannello mostra la distanza effettiva sulla schiuma (0,28 mm)");
// two rails: no width field (the rails give it)
const rails = renderToStaticMarkup(createElement(entry.Section, { o: obj(f, [obj(f).paths[0], { closed: false, nodes: [{ p: [0, 5] }, { p: [40, 5] }] }]), targets: ["f"], up: () => {}, live: () => {}, begin: () => {} }));
check(!rails.includes(t("j.foam.width")), "con due binari la larghezza la danno i binari");
off();
check(stitchTypeOf(f) === null, "install() si può togliere");

done("j schiuma");
