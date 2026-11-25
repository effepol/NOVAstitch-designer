// Fields registered for a Filum stitch type (module 0, Architect 25/11 evening):
// the hook of #58 drew them only inside the appliqué's block, so module j's
// «3D foam» never showed on a satin. Now every Filum type's section shows the
// fields registered for it (no place: at the end of the section); the
// appliqué keeps its steps; nothing is shown twice.

import { check, done } from "./testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import type { DesignObject, StitchDocument, StitchParams, SubPath, Vec2 } from "../../types";
import { defaultApplique, defaultFill, defaultRunning, defaultSatin } from "../../lib/geometry";
import { registerStitchFields } from "./stitchTypes";
import { PropertiesPanel } from "../../components/Dock";

const line: SubPath[] = [{ closed: false, nodes: [{ p: [0, 0] as Vec2 }, { p: [30, 0] as Vec2 }] }];
const ring: SubPath[] = [{ closed: true, nodes: ([[0, 0], [20, 0], [20, 20], [0, 20]] as Vec2[]).map((p) => ({ p })) }];
const obj = (id: string, paths: SubPath[], stitch: StitchParams): DesignObject => ({ id, name: id, thread: "T1", visible: true, locked: false, paths, stitch, trimAfter: false, stopAfter: false });
const doc: StitchDocument = {
  ...emptyDoc(),
  threads: [{ id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" }],
  objects: [
    obj("S", line, { type: "satin", ...defaultSatin() }),
    obj("F", ring, { type: "fill", ...defaultFill() }),
    obj("R", line, { type: "running", ...defaultRunning() }),
    obj("A", ring, { type: "applique", ...defaultApplique() }),
  ],
};
// rendered on the "server": zustand reads its initial state there, so the test writes into it
const show = (id: string) => {
  useStore.setState({ doc, selection: [id] });
  Object.assign(useStore.getInitialState(), { doc, selection: [id] });
  return renderToStaticMarkup(createElement(PropertiesPanel));
};
const before = Object.fromEntries(["S", "F", "R", "A"].map((id) => [id, show(id)]));

const offs = [
  registerStitchFields({ id: "j.foam", module: "j", type: "satin", Fields: () => createElement("div", null, "Schiuma 3D") }),
  registerStitchFields({ id: "x.fill", module: "x", type: "fill", Fields: () => createElement("div", null, "Campo del riempimento") }),
  registerStitchFields({ id: "x.run", module: "x", type: "running", Fields: () => createElement("div", null, "Campo del punto dritto") }),
  registerStitchFields({ id: "j.applique", module: "j", type: "applique", place: "placement", Fields: () => createElement("div", null, "Rientro") }),
];
const count = (html: string, text: string) => html.split(text).length - 1;
const marked = (html: string, text: string) => new RegExp(`data-nova="[a-z]"[^>]*>(<[^>]+>)*${text}`).test(html);

const s = show("S");
check(count(s, "Schiuma 3D") === 1 && marked(s, "Schiuma 3D"), "a satin shows the section registered for «satin» (module j's 3D foam), marked data-nova");
const f = show("F");
check(count(f, "Campo del riempimento") === 1 && marked(f, "Campo del riempimento"), "a fill shows the fields registered for «fill»");
const r = show("R");
check(count(r, "Campo del punto dritto") === 1 && marked(r, "Campo del punto dritto"), "a running stitch shows the fields registered for «running»");
check(!s.includes("Campo del riempimento") && !f.includes("Schiuma 3D") && !r.includes("Schiuma 3D"), "each type only its own fields");
const a = show("A");
check(count(a, "Rientro") === 1 && !a.includes("Schiuma 3D"), "the appliqué: its placement field once, in its step, as before");
// at the end of the type's own fields: after the satin's last row of Filum
const lastFilumRow = s.lastIndexOf("Pull comp.");
check(lastFilumRow > 0 && s.indexOf("Schiuma 3D") > lastFilumRow, "the section comes after the type's own fields");
for (const off of offs) off();
check(["S", "F", "R", "A"].every((id) => show(id) === before[id]), "removed: every panel exactly as before");

done("campi registrati in ogni tipo di Filum");
