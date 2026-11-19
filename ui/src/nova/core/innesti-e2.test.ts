// Module e, second request of 19/11 (module 0).
// (1) In module 0's composed defaults, the fabric calibration's fill.expand is
//     ADDED to the registered one (the preset's overlap); pull and push
//     compensation are replaced by the calibration's, as before.
// (2) Two registrable spaces: in the fabric panel (MaterialPanel.tsx, under the
//     fabric picker) and in the export dialog (ExportDialog.tsx); a module puts
//     its component there, marked data-nova; nothing registered, nothing changes.

import { check, done } from "./testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import { defaultFill, defaultSatin, setFabricDefaults } from "../../lib/geometry";
import { composedFabricDefaults, registerObjectDefaults } from "./objectDefaults";
import { registerSlot, slotEntries } from "./slots";
import { MaterialSection } from "../../components/MaterialPanel";
import { ExportDialog } from "../../components/ExportDialog";

const num = (o: unknown, k: string) => (o as Record<string, number>)[k];

// ---------------------------------------------------------------- (1)
let calibration: { satin?: Record<string, number>; fill?: Record<string, number> } = {};
setFabricDefaults(composedFabricDefaults(() => calibration));
const off = registerObjectDefaults({ id: "e.preset", module: "e", values: () => ({ satin: { pullComp: 0.2, pushComp: 0.1 }, fill: { expand: 0.4, pullComp: 0.25, pushComp: 0.15 } }) });
check(num(defaultFill(), "expand") === 0.4, "no calibration: the preset's expand");
calibration = { satin: { pullComp: 0.6, pushComp: 0.5 }, fill: { expand: 0.3, pullComp: 0.45, pushComp: 0.35 } };
check(Math.abs(num(defaultFill(), "expand") - 0.7) < 1e-9, "fill.expand: the calibration's is added to the preset's (0.4 + 0.3)");
check(num(defaultFill(), "pullComp") === 0.45 && num(defaultFill(), "pushComp") === 0.35, "fill pull and push compensation: the calibration's replace the preset's");
check(num(defaultSatin(), "pullComp") === 0.6 && num(defaultSatin(), "pushComp") === 0.5, "satin pull and push compensation: the calibration's replace the preset's");
check(Number.isFinite(num(defaultFill(), "expand")) && String(num(defaultFill(), "expand")).length <= 6, "the sum is a tidy number");
off();
check(num(defaultFill(), "expand") === 0.3, "no preset: the calibration's expand alone (as in Filum)");
calibration = {};
setFabricDefaults(() => ({}));

// ---------------------------------------------------------------- (2)
const doc = { ...emptyDoc(), fabric: "cotton" as const };
const serve = () => {
  useStore.setState({ doc });
  // rendered on the "server": zustand reads its initial state there
  Object.assign(useStore.getInitialState(), { doc });
};
serve();
const material = () => renderToStaticMarkup(createElement(MaterialSection));
const exportDlg = () => renderToStaticMarkup(createElement(ExportDialog, { onClose: () => {} }));
const filumMaterial = material();
const filumExport = exportDlg();
check(!filumMaterial.includes("data-nova") && filumMaterial.includes("<select"), "nothing registered: Filum's fabric panel");

const offs = [
  registerSlot({ id: "e.sheet", module: "e", slot: "material", Component: () => createElement("p", null, "Scheda del tessuto") }),
  registerSlot({ id: "e.exportSheet", module: "e", slot: "export", Component: ({ format }) => createElement("p", null, `Scheda per ${format}`) }),
];
let dup = false;
try {
  registerSlot({ id: "e.sheet", module: "e", slot: "material", Component: () => null });
} catch {
  dup = true;
}
check(dup, "a slot id registers once");
check(slotEntries("material").length === 1 && slotEntries("export").length === 1, "entries by space");

const m = material();
check(/<div data-nova="e"[^>]*>(<[^>]+>)*Scheda del tessuto/.test(m), "fabric panel: the module's component, marked data-nova=\"e\"");
const sel = m.indexOf("</select>");
const sheet = m.indexOf("Scheda del tessuto");
const nextRow = m.indexOf('<div class="row"', sel);
check(sel > 0 && sheet > sel && (nextRow < 0 || sheet < nextRow), "fabric panel: right under the fabric picker (before the thread row)");
const x = exportDlg();
check(/<div data-nova="e"[^>]*>(<[^>]+>)*Scheda per [a-z0-9]+/.test(x), "export dialog: the module's component, marked data-nova=\"e\", told the format");
check(x.indexOf("Scheda per") < x.indexOf('class="xp-main"'), "export dialog: in the settings column");
for (const o of offs) o();
check(material() === filumMaterial && exportDlg() === filumExport, "removed: both exactly as in Filum");

done("innesti e, seconda richiesta");
