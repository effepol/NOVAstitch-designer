// Test R (approved 12/11): registries for menu items, panels, canvas layers and toolbar buttons.

import { check, done } from "./testkit";
import { registerMenuItem, registerPanel, registerCanvasLayer, registerToolbarButton, panels, canvasLayers, toolbarButtons, drawCanvasLayers } from "./registry";
import { addCatalog, getLanguage, setLanguage } from "./i18n";
import { registerCoreItems } from "./menu";
import { buildMenus, type MenuItem } from "../../components/menuModel";

addCatalog({ "test.menu.b": "Voce B", "test.menu.a": "Voce A" }, { "test.menu.b": "Item B", "test.menu.a": "Item A" });
setLanguage("en");
const ran: string[] = [];
const offA = registerMenuItem({ id: "test.a", module: "test", menu: "View", label: "test.menu.a", order: 1, run: () => ran.push("a") });
registerMenuItem({ id: "test.b", module: "test", menu: "View", label: "test.menu.b", order: 2, run: () => ran.push("b") });

// in Filum's menu, in the given order, translated
const labels = (buildMenus()["View"] ?? []).filter((i): i is Exclude<MenuItem, "-"> => i !== "-").map((i) => i.label);
const ia = labels.indexOf("Item A");
const ib = labels.indexOf("Item B");
check(ia >= 0 && ib === ia + 1, `R the menu items appear in Filum's View menu, in order (${labels.slice(-4).join(" | ")})`);

registerPanel({ id: "test.p2", module: "test", title: "test.menu.b", order: 2, render: () => null });
registerPanel({ id: "test.p1", module: "test", title: "test.menu.a", order: 1, render: () => null });
check(panels().map((p) => p.id).join() === "test.p1,test.p2", "R panels listed in order");

const drawn: string[] = [];
registerCanvasLayer({ id: "test.l2", module: "test", order: 2, draw: () => drawn.push("l2") });
registerCanvasLayer({ id: "test.l1", module: "test", order: 1, draw: () => drawn.push("l1") });
drawCanvasLayers({} as CanvasRenderingContext2D, { scale: 1, ox: 0, oy: 0 });
check(canvasLayers().length === 2 && drawn.join() === "l1,l2", "R canvas layers drawn in order");

registerToolbarButton({ id: "test.t1", module: "test", label: "test.menu.a", order: 1, run: () => ran.push("t") });
check(toolbarButtons().map((b) => b.id).join() === "test.t1", "R toolbar button listed");

// a duplicate id is refused, naming the module
let msg = "";
try {
  registerMenuItem({ id: "test.a", module: "other", menu: "View", label: "test.menu.a", run: () => {} });
} catch (e) {
  msg = (e as Error).message;
}
check(msg.includes("test.a") && msg.includes("other"), `R a duplicate id is refused with an error naming the module ("${msg}")`);

// removal
offA();
const after = (buildMenus()["View"] ?? []).filter((i): i is Exclude<MenuItem, "-"> => i !== "-").map((i) => i.label);
check(!after.includes("Item A") && after.includes("Item B"), "R unregistering removes the item");

// module 0's own items: the language, in the Edit menu
registerCoreItems();
const edit = () => (buildMenus()["Edit"] ?? []).filter((i): i is Exclude<MenuItem, "-"> => i !== "-");
const english = edit().find((i) => i.label === "Language: English");
const italian = edit().find((i) => i.label === "Language: Italian");
check(!!english?.checked && !!italian && !italian.checked, "R the Edit menu offers the languages, the current one checked");
italian!.run!();
check(getLanguage() === "it" && !!edit().find((i) => i.label === "Lingua: italiano")?.checked, "R choosing Italian there switches the interface to Italian");

done("registry");
