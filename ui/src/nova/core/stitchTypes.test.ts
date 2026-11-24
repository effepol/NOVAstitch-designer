// Hook «stitch types of the modules» (module 0, for module j, request of 19/11).
// Filum's stitch type picker (StitchPanel.tsx StylePicker) shows the types a
// module registers too (foam, layered3d), marked data-nova; when the object
// has one of them, the properties panel shows the module's section instead of
// Filum's. New appliqué fields (placementInset, freeEdge) go into Filum's
// existing appliqué section through the same registry. Texts: the module's.

import { check, done } from "./testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import type { DesignObject, StitchDocument, StitchParams, SubPath, Vec2 } from "../../types";
import { defaultApplique, defaultSatin } from "../../lib/geometry";
import { registerStitchFields, registerStitchType, stitchFieldsFor, stitchTypeOf, stitchTypes } from "./stitchTypes";
import { PropertiesPanel } from "../../components/Dock";

const line = (a: Vec2, b: Vec2): SubPath => ({ closed: false, nodes: [{ p: a }, { p: b }] });
const ring: SubPath = { closed: true, nodes: ([[0, 0], [20, 0], [20, 20], [0, 20]] as Vec2[]).map((p) => ({ p })) };
const obj = (id: string, paths: SubPath[], stitch: StitchParams): DesignObject => ({ id, name: id, thread: "T1", visible: true, locked: false, paths, stitch, trimAfter: false, stopAfter: false });
const satin = obj("S", [line([0, 0], [30, 0])], { type: "satin", ...defaultSatin() });
const foamSatin = obj("F", [line([0, 0], [30, 0])], { type: "satin", ...defaultSatin(), foam: { height: 3 } } as unknown as StitchParams);
const app = obj("A", [ring], { type: "applique", ...defaultApplique() });
const doc: StitchDocument = { ...emptyDoc(), threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }], objects: [satin, foamSatin, app] };
// rendered on the "server": zustand reads its initial state there, so the test writes into it
const show = (id: string) => {
  useStore.setState({ doc, selection: [id] });
  Object.assign(useStore.getInitialState(), { doc, selection: [id] });
  return renderToStaticMarkup(createElement(PropertiesPanel));
};

// Filum alone
const filumSatin = show("S");
const filumFoam = show("F");
const filumApp = show("A");
check(!filumSatin.includes("data-nova=\"j\""), "nothing registered: no module card in the picker");

// registry
const isFoam = (st: StitchParams) => st.type === "satin" && !!(st as { foam?: unknown }).foam;
const offFoam = registerStitchType({
  id: "j.foam",
  module: "j",
  group: "line",
  label: () => "Satin su schiuma 3D",
  title: () => "Satin alto per la schiuma",
  icon: createElement("svg", { viewBox: "0 0 40 28" }),
  matches: isFoam,
  apply: (o) => ({ type: "satin", ...defaultSatin(), ...(o.stitch.type === "satin" ? o.stitch : {}), foam: { height: 3 } }) as unknown as StitchParams,
  Section: ({ o }) => createElement("div", { className: "j-foam" }, `Altezza schiuma ${(o.stitch as { foam?: { height: number } }).foam?.height} mm`),
});
const offLayered = registerStitchType({
  id: "j.layered3d",
  module: "j",
  group: "fill",
  label: () => "3D a strati",
  icon: createElement("svg", { viewBox: "0 0 40 28" }),
  matches: (st) => st.type === "fill" && !!(st as { layered3d?: unknown }).layered3d,
  apply: () => ({ type: "fill", method: "tatami", angle: 0, layered3d: { layers: 3 } }) as unknown as StitchParams,
  Section: () => createElement("div", { className: "j-layered" }, "Strati"),
});
let dup = false;
try {
  registerStitchType({ id: "j.foam", module: "j", group: "line", label: () => "x", icon: null, matches: () => false, apply: (o) => o.stitch, Section: () => null });
} catch {
  dup = true;
}
check(dup, "a type id registers once");
check(stitchTypes().map((e) => e.id).join() === "j.foam,j.layered3d", "the registered types, in order");
check(stitchTypeOf(foamSatin.stitch)?.id === "j.foam" && stitchTypeOf(satin.stitch) === null, "stitchTypeOf: the registered type the stitch has, else null");

// the picker
const pSatin = show("S");
check(/<button[^>]*data-nova="j"[^>]*>.*?Satin su schiuma 3D/.test(pSatin), "the picker shows the module's line type, marked data-nova=\"j\"");
check(!pSatin.includes("3D a strati"), "a fill type is not offered for an open line (as Filum's fills)");
const pApp = show("A");
check(pApp.includes("3D a strati") && pApp.includes("Satin su schiuma 3D"), "a closed shape: the module's fill and line types");
check(/<button[^>]*class="style-card on"[^>]*data-nova="j"|<button[^>]*data-nova="j"[^>]*class="style-card on"/.test(show("F")), "the object's registered type is the card shown as chosen");
const pFoam = show("F");
check(!/class="style-card on"(?![^>]*data-nova)/.test(pFoam.replace(/<button[^>]*data-nova="j"[^>]*>/g, "")), "Filum's own Satin card is not chosen too");

// the section
check(pFoam.includes("Altezza schiuma 3 mm") && /data-nova="j"[^>]*>(<[^>]+>)*Altezza schiuma/.test(pFoam), "the module's section, marked data-nova=\"j\"");
// Filum's satin section (what the plain satin shows below the picker) is not there for foam
const satinOnly = (html: string) => html.slice(html.indexOf("style-extra"));
const satinRows = [">Density<", ">Width<", ">Pull comp.<"];
check(satinRows.every((r) => satinOnly(show("S")).includes(r)), "(reference) a plain satin shows Filum's satin rows");
check(satinRows.every((r) => !satinOnly(pFoam).includes(r)), "the module's section instead of Filum's satin section");
check(satinOnly(show("S")) === satinOnly(filumSatin), "a plain satin keeps Filum's section");

// appliqué fields
const offFields = [
  registerStitchFields({ id: "j.placementInset", module: "j", type: "applique", place: "placement", Fields: ({ o }) => createElement("div", { className: "j-inset" }, `Rientro ${(o.stitch as { placementInset?: number }).placementInset ?? 0} mm`) }),
  registerStitchFields({ id: "j.freeEdge", module: "j", type: "applique", place: "cover", Fields: () => createElement("div", { className: "j-free" }, "Bordo libero") }),
];
check(stitchFieldsFor("applique", "placement").length === 1 && stitchFieldsFor("applique", "cover").length === 1 && stitchFieldsFor("satin").length === 0, "fields by stitch type and place");
const pApp2 = show("A");
check(/data-nova="j"[^>]*>(<[^>]+>)*Rientro [0-9.]+ mm/.test(pApp2) && /data-nova="j"[^>]*>(<[^>]+>)*Bordo libero/.test(pApp2), "the appliqué fields, marked data-nova=\"j\"");
const at = (s: string) => pApp2.indexOf(s);
const step = (n: number) => pApp2.search(new RegExp(`data-section="${n} ·`));
check(step(1) > 0 && step(2) > step(1) && step(3) > step(2), "(reference) Filum's three appliqué steps");
check(at("Rientro") > step(1) && at("Rientro") < step(2), "the placement field inside Filum's step 1 (placement line)");
check(at("Bordo libero") > step(3), "the cover field inside Filum's step 3 (cover)");
for (const off of offFields) off();
offFoam();
offLayered();
check(show("A") === filumApp && show("F") === filumFoam, "removed: Filum's panel exactly as before");

done("tipi di punto dei moduli");
