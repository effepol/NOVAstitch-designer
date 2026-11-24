// Contract tests j.9 and j.10 (module j), the interface's part: a new appliqué
// starts from the Punch values (the stitches themselves: cargo test, applique.rs
// j9_new_applique_defaults and j10_free_edge), its new fields are in Filum's
// appliqué section, and an appliqué from an old file keeps Filum's values.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultStitch } from "../../lib/geometry";
import { stitchFieldsFor } from "../core/stitchTypes";
import { setLanguage, t } from "../core/i18n";
import type { AppliqueParams, DesignObject } from "../../types";
import { installStitch3d } from "./install";
import anchors from "./anchors.json";

const st = defaultStitch("applique") as AppliqueParams & { type: "applique" };
check(st.placementInset === 1.25, "j.9 linea di posizionamento 1,25 mm dentro la forma");
check(st.tackdown === "run" && st.tackdownInset === 2, "j.9 tack-down a punto dritto, 2 mm dentro il bordo (24/11)");
check(st.coverWidth / 2 > st.tackdownInset, `j.9 la copertura (${st.coverWidth} mm sul bordo) copre il tack-down`);
check(st.freeEdge === false, "j.10 bordo libero spento di default");

const off = installStitch3d();
const fields = stitchFieldsFor("applique", "placement");
check(fields.length === 1 && fields[0].module === "j", "i campi nuovi stanno nella sezione «linea di posizionamento» di Filum");

const obj = (stitch: unknown): DesignObject => ({ id: "a", name: "a", thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false, paths: [], stitch: stitch as DesignObject["stitch"] });
const html = (o: DesignObject) => renderToStaticMarkup(createElement(fields[0].Fields, { o, targets: [o.id], up: () => {}, live: () => {}, begin: () => {} }));
setLanguage("it");
let h = html(obj(st));
check(h.includes(t("j.applique.placementInset")) && h.includes(t("j.applique.freeEdge")), "rientro e bordo libero nel pannello, in italiano");
for (const a of ["j.applique.placementInset", "j.applique.freeEdge"]) check(h.includes(`data-nova-anchor="${a}"`) && a in anchors, `ancora ${a} nella pagina e in anchors.json`);
h = html(obj({ ...st, freeEdge: true }));
check(!h.includes(t("j.applique.placementInset")), "j.10 bordo libero: il rientro (fisso a 5 mm) non si regola");

// an appliqué saved by Filum: no new fields, Filum's values stay
const old = { type: "applique", placement: true, placementLength: 2, tackdown: "zigzag", tackdownWidth: 1.6, tackdownInset: 0.6, tackdownSpacing: 1.2, cover: "satin", coverWidth: 3, coverSpacing: 0.4, coverOffset: 0, coverUnderlay: true, pullComp: 0, flip: false, stops: true };
h = html(obj(old));
check(h.includes('value="0"') || h.includes(">0<"), "un appliqué di un file vecchio mostra rientro 0 (sul bordo, come in Filum)");
off();
check(stitchFieldsFor("applique", "placement").length === 0, "install() si può togliere");

done("j appliqué");
