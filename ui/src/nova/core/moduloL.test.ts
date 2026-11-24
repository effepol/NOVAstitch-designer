// Hooks for module l (module 0, request of 20/11).
// (1) File › «Print PDF» (and Ctrl+P, the same command) runs the registered
//     command l.sheet.export when there is one; without it, Filum's
//     "production" dialog. Same label, from Filum's catalogue.
// (2) A registrable space on every thread of Filum's thread panel (Thread
//     colours, ThreadManager.tsx), where a module puts its control (the
//     standard / metallic picker), marked data-nova.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import type { StitchDocument } from "../../types";
import { registerCommand } from "./commands";
import { registerSlot } from "./slots";
import { buildMenus } from "../../components/menuModel";
import { ThreadManager } from "../../components/ThreadManager";
import { t } from "../i18n/filum";

const st = () => useStore.getState();

// ---------------------------------------------------------------- (1)
const printItem = () => buildMenus().File.find((i) => i !== "-" && i.label === t("filum.menu.print_pdf"));
const item0 = printItem();
check(!!item0 && item0 !== "-", "File › Print PDF is there, with Filum's label");
useStore.setState({ dialog: null });
if (item0 && item0 !== "-") item0.run?.();
check(st().dialog === "production", "no l.sheet.export: Filum's production dialog");

let ran = 0;
const off = registerCommand({ id: "l.sheet.export", label: { it: "Scheda", en: "Sheet" }, apply: (d) => (ran++, d) });
useStore.setState({ dialog: null, past: [] });
const item1 = printItem();
check(!!item1 && item1 !== "-", "with l.sheet.export: the same item, the same label");
if (item1 && item1 !== "-") item1.run?.();
check(ran === 1 && st().dialog === null, "with l.sheet.export: the module's command runs, not Filum's dialog");
check(st().past.length === 0, "a command that changes nothing leaves no undo step");
off();
useStore.setState({ dialog: null });
const item2 = printItem();
if (item2 && item2 !== "-") item2.run?.();
check(st().dialog === "production" && ran === 1, "removed: Filum's dialog again");
const app = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
check(/p: \(\) => \(e\.shiftKey \? s\.setDialog\("palette"\) : printSheet\(/.test(app), "Ctrl+P goes the same way (Ctrl+Shift+P stays the palette)");

// ---------------------------------------------------------------- (2)
const doc: StitchDocument = {
  ...emptyDoc(),
  threads: [
    { id: "T1", name: "Rosso", color: "#cc0000", brand: "", code: "" },
    { id: "T2", name: "Oro", color: "#c9a227", brand: "", code: "" },
  ],
};
const serve = () => {
  useStore.setState({ doc });
  // rendered on the "server": zustand reads its initial state there
  Object.assign(useStore.getInitialState(), { doc });
};
serve();
const panel = () => renderToStaticMarkup(createElement(ThreadManager, { onClose: () => {} }));
const filum = panel();
check(filum.includes("tm-row") && !filum.includes('data-nova="l"'), "nothing registered: Filum's thread panel");
const offSlot = registerSlot({ id: "l.kind", module: "l", slot: "thread", Component: ({ thread }) => createElement("select", { "aria-label": `Tipo ${thread.name}` }) });
const html = panel();
check(/<div[^>]*data-nova="l"[^>]*>(<[^>]+>)*<select aria-label="Tipo Rosso"/.test(html) && /data-nova="l"[^>]*>(<[^>]+>)*<select aria-label="Tipo Oro"/.test(html), "a control on every thread, told which thread, marked data-nova=\"l\"");
const rows = html.split('class="tm-row').slice(1);
check(rows.length === 2 && rows[0].includes("Tipo Rosso") && rows[1].includes("Tipo Oro"), "each inside its own thread's row");
offSlot();
check(panel() === filum, "removed: Filum's panel exactly as before");

done("innesti per il modulo l");
