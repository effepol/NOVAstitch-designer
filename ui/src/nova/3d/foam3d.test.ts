// The «Schiuma 3D» card (module j; Signor Poletti's note 2 on build 0.1.1,
// Architect 26/11): the foam is a satin option (SatinParams.foam), and the user
// looks for it as a card in the stitch picker. The card makes the object a
// satin as Filum's Satin card does (rails kept) with the foam on, in one undo
// step. It is never the object's own type (matches: false), so a satin over
// foam keeps Filum's satin section in the panel (its settings and the switch
// that takes the foam off); module 0's hook replaces it for a type it matches.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import { defaultRunning, defaultSatin, rectPath } from "../../lib/geometry";
import { stitchTypeOf, stitchTypes } from "../core/stitchTypes";
import { setLanguage, t } from "../core/i18n";
import type { DesignObject, SatinParams, StitchDocument, StitchParams, SubPath, Vec2 } from "../../types";
import { PropertiesPanel } from "../../components/Dock";
import { LINE_STYLES } from "../../components/StitchPanel";
import { installStitch3d } from "./install";
import { defaultFoam } from "./foam";
import { fabricIssues } from "../presets/issues";
import { parsePreset } from "../presets/preset";
import { sheetBoxes } from "../worksheet/sheetData";

const line = (a: Vec2, b: Vec2): SubPath => ({ closed: false, nodes: [{ p: a }, { p: b }] });
const obj = (id: string, paths: SubPath[], stitch: StitchParams): DesignObject => ({ id, name: id, thread: "T1", visible: true, locked: false, paths, stitch, trimAfter: false, stopAfter: false });
const run = obj("R", [line([0, 0], [30, 0])], { type: "running", ...defaultRunning() });
const shape = obj("Q", [rectPath(0, 10, 20, 20)], { type: "fill" } as StitchParams);
const rails: SubPath[] = [line([0, 30], [30, 30]), line([0, 35], [30, 35])];
const twoRails = obj("T", rails, { type: "satin", ...defaultSatin(), width: 5, spacing: 0.35 });
const docOf = (objects: DesignObject[]): StitchDocument => ({ ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects });
const show = (doc: StitchDocument, id: string) => {
  useStore.setState({ doc, selection: [id] });
  Object.assign(useStore.getInitialState(), { doc, selection: [id] });
  return renderToStaticMarkup(createElement(PropertiesPanel));
};

setLanguage("it");
const off = installStitch3d();
const card = stitchTypes().find((e) => e.id === "j.foam3d")!;
check(!!card && card.module === "j" && card.group === "line", "il pulsante «Schiuma 3D» (j.foam3d) sta con le linee, accanto a Satin e 3D a strati");
check(card.label() === "Schiuma 3D" && !!card.title?.(), "nome e spiegazione in italiano");
setLanguage("en");
check(card.label() === "3D foam", "in inglese: 3D foam");
setLanguage("it");

// in the picker, beside Satin and 3D a strati
const html = show(docOf([run]), "R");
const at = (s: string) => html.indexOf(s);
check(/data-nova="j"[^>]*>(<[^>]+>)*Schiuma 3D/.test(html) || (html.includes("Schiuma 3D") && html.includes('data-nova="j"')), "la scheda «Schiuma 3D» è nel selettore dei punti");
check(at("Satin") >= 0 && at("Schiuma 3D") >= 0 && at("3D a strati") >= 0, "nel selettore: Satin, Schiuma 3D, 3D a strati");

// a running line or a shape → a satin over foam, foam = defaultFoam(), one undo step (Filum's picker: one commit)
const pick = (o: DesignObject) => {
  useStore.getState().setDoc(docOf([o]));
  const before = useStore.getState().past.length;
  const st = card.apply(o);
  useStore.getState().commit((d) => ({ ...d, objects: d.objects.map((x) => (x.id === o.id ? { ...x, stitch: st } : x)) }));
  return { now: useStore.getState().doc.objects[0], steps: useStore.getState().past.length - before };
};
for (const o of [run, shape]) {
  const { now, steps } = pick(o);
  const st = now.stitch as SatinParams & { type: "satin" };
  check(st.type === "satin" && st.method === "satin" && JSON.stringify(st.foam) === JSON.stringify(defaultFoam()), `${o.id === "R" ? "linea a corsa" : "forma"} → satin con la schiuma di default (1 passata, × 1,45, cappucci)`);
  check(JSON.stringify(now.paths) === JSON.stringify(o.paths), "le linee dell'oggetto restano");
  check(steps === 1, "un solo passo di Annulla");
  useStore.getState().undo();
  check(useStore.getState().doc.objects[0].stitch.type === o.stitch.type, "Annulla: torna com'era");
}
// a satin on two rails: rails and its own values stay, the foam on
const { now: t2 } = pick(twoRails);
const s2 = t2.stitch as SatinParams & { type: "satin" };
check(JSON.stringify(t2.paths) === JSON.stringify(rails) && s2.spacing === 0.35 && s2.width === 5 && !!s2.foam, "satin a due binari → binari e valori invariati, schiuma accesa");
// a satin that already has foam keeps its own foam values
const mine = { ...defaultFoam(), contourPasses: 2 };
check((card.apply(obj("M", rails, { ...s2, foam: mine })) as SatinParams).foam?.contourPasses === 2, "già con la schiuma: i suoi valori restano");

// a satin over foam: Filum's satin section stays (settings and the switch that takes the foam off)
const foamSatin = obj("F", rails, { type: "satin", ...defaultSatin(), foam: defaultFoam() });
check(stitchTypeOf(foamSatin.stitch) === null, "il satin con la schiuma resta un satin di Filum (matches falso)");
const panel = show(docOf([foamSatin]), "F");
check(panel.includes(">Density<") || panel.includes("Densit"), "la sezione del satin di Filum resta");
check(panel.includes('data-nova-anchor="j.foam.on"'), "e c'è l'interruttore per togliere la schiuma");
// Filum's Satin card on a satin over foam: the foam stays, as today
const satinCard = LINE_STYLES.find((s) => s.id === "satin")!;
const back = satinCard.apply(foamSatin) as SatinParams & { type: "satin" };
check(typeof back === "object" && JSON.stringify(back.foam) === JSON.stringify(defaultFoam()), "il pulsante Satin di Filum su un satin con schiuma non toglie la schiuma");

// module l's sheet and module e's warnings know the foam as before
check(sheetBoxes(docOf([t2])).includes("foam"), "scheda di lavoro: riquadro SCHIUMA 3D");
const stable = parsePreset("stabile.json", {
  id: "stabile", schemaVersion: 1, rev: 1, name: { it: "Prova", en: "Test" }, base: "cotton", elastic: false, overlap: { flat: 0.2, cap: 0.4 }, limits: { minSpacingRatio: 0.75 },
  info: { it: "Prova", en: "Test" }, stabilizer: { type: "tear-away", weight: "medium" }, topping: "none", needlePoint: "normal",
});
const dense = (st: SatinParams & { type: "satin" }) => fabricIssues({ ...docOf([obj("D", rails, st)]), nova: { schemaVersion: 1, fabricPreset: { id: "stabile", rev: 1 } } }, null, stable).filter((i) => i.id.startsWith("e.dense:")).length;
check(dense({ ...s2, spacing: 0.15 }) === 0 && dense({ ...s2, spacing: 0.15, foam: undefined }) === 1, "problemi: nessun e.11 sulla schiuma, e.11 sul satin normale come prima");
check(t("j.foam3d.title").length > 0, "spiegazione nel catalogo");
off();
check(!stitchTypes().some((e) => e.id === "j.foam3d"), "install() si può togliere");

done("j pulsante Schiuma 3D");
