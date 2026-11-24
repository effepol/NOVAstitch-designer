// Contract tests j.6, j.8 and j.12 (module j), the interface's part: the
// layered 3D stitch type in Filum's picker and panel. The layers themselves
// (4 + the final one, staggered by 0.3 mm, base thread under, metallic on
// top, 5 layers refused) are checked by cargo test, crates/core/src/stitches/layered3d.rs.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultSatin } from "../../lib/geometry";
import { stitchTypeOf } from "../core/stitchTypes";
import { setLanguage, t } from "../core/i18n";
import type { DesignObject, Layered3dParams, Thread } from "../../types";
import { installStitch3d } from "./install";
import { acceptsLayers, LAYERED3D_SHRINK, toLayered3d } from "./layered3d";
import { defaultFoam } from "./foam";
import { sheetBoxes } from "../worksheet/sheetData";
import { emptyDoc } from "../../store";
import anchors from "./anchors.json";

const line: DesignObject["paths"] = [{ closed: false, nodes: [{ p: [0, 0] }, { p: [40, 0] }] }];
const obj = (stitch: unknown, paths = line): DesignObject => ({ id: "l", name: "l", thread: "oro", visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch: stitch as DesignObject["stitch"] });

// from a satin: its own values stay (not the foam block), the layered 3D's defaults join them
const satin = { type: "satin" as const, ...defaultSatin(), width: 12, foam: defaultFoam() };
const l = toLayered3d(obj(satin)) as { type: "layered3d" } & Layered3dParams;
check(l.type === "layered3d" && l.width === 12 && !("foam" in l), "la colonna satin diventa 3D a strati con la sua larghezza (senza il blocco schiuma)");
check(l.layers === 2 && l.shrinkPerLayer === LAYERED3D_SHRINK && l.underlayZigzagSpacing === defaultSatin().zigzagUnderlaySpacing && l.baseThread === undefined, "default: 2 strati (24/11), restringimento 0,6 (provvisorio), zigzag dell'anima come Filum, filo dell'oggetto");
check([2, 3, 4].every(acceptsLayers) && !acceptsLayers(5) && !acceptsLayers(1), "j.12 strati: da 2 a 4; 5 rifiutato");

const off = installStitch3d();
const entry = stitchTypeOf(l);
check(entry?.id === "j.layered3d" && entry.group === "line", "il 3D a strati è il tipo j.layered3d (letto anche dal modulo l), con le linee accanto al satin");
setLanguage("it");
check(entry!.label() === "3D a strati", "nome in italiano");
const threads: Thread[] = [
  { id: "oro", name: "Oro", color: "#c9a227", brand: "Madeira", code: "1", nova: { kind: "metallic" } },
  { id: "poli", name: "Giallo", color: "#e6c200", brand: "Madeira", code: "2" },
];
const html = (st: unknown) => renderToStaticMarkup(createElement(entry!.Section as never, { o: obj(st), targets: ["l"], up: () => {}, live: () => {}, begin: () => {}, threads }));
const h = html(l);
for (const k of ["j.layered3d.layers", "j.layered3d.underlayZigzagSpacing", "j.layered3d.shrinkPerLayer", "j.layered3d.baseThread"]) check(h.includes(t(k).replace(/'/g, "&#x27;")), `nel pannello: ${t(k)}`);
for (const a of ["j.layered3d.section", "j.layered3d.layers", "j.layered3d.baseThread"]) check(h.includes(`data-nova-anchor="${a}"`) && a in anchors, `ancora ${a}`);
check(h.includes(">Giallo · Madeira · 2<") && !h.includes(">Oro"), "j.8 il filo degli strati interni si sceglie tra gli altri fili del disegno");
check(/<option value="poli" selected="">/.test(html({ ...l, baseThread: "poli" })), "j.8 il filo scelto resta scelto");

// module l's work sheet: the 3D A STRATI box
const doc = { ...emptyDoc(), objects: [obj(l)], threads };
check(sheetBoxes(doc).includes("layered3d"), "scheda di lavoro: riquadro 3D A STRATI");
off();
check(stitchTypeOf(l) === null, "install() si può togliere");

done("j 3D a strati");
