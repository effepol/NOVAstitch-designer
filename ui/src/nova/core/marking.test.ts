// Rule i.3 (contract, 13/11): everything Filum's interface draws from module 0's
// registries carries data-nova="<module>", set by module 0 at the hook point (not by
// the modules): panel tabs and their content, menu items (and menus a module adds),
// bar buttons, command palette entries, hoop groups in the hoop pickers. Module i's
// tour leaves the marked elements out of the comparison with Filum 0.2.1.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { registerMenuItem } from "./registry";
import { buildMenus, menuOwner, type MenuEntry } from "../../components/menuModel";

// menus: registered items carry their module, Filum's own do not; a menu a module adds is marked too
const offs = [
  registerMenuItem({ id: "test.edit", module: "test", menu: "Edit", label: "test.edit", run: () => {} }),
  registerMenuItem({ id: "test.new", module: "test", menu: "Prova", label: "test.new", run: () => {} }),
];
const menus = buildMenus();
const entries = (name: string) => (menus[name] ?? []).filter((i): i is MenuEntry => i !== "-");
const mine = entries("Edit").filter((i) => i.nova === "test");
check(mine.length === 1, "a registered item in a Filum menu carries data-nova's module");
check(entries("File").length > 0 && entries("File").every((i) => !i.nova), "Filum's own items carry no mark");
check(entries("Prova").every((i) => i.nova === "test") && menuOwner("Prova") === "test", "a menu a module adds is marked with the module");
check(menuOwner("Edit") === undefined && menuOwner("File") === undefined, "Filum's own menus are not marked");
offs.forEach((off) => off());

// the hook points write the attribute
const src = path.resolve(process.cwd(), "src");
const read = (f: string) => readFileSync(path.join(src, f), "utf8");
const panels = read("components/Panels.tsx");
check(/nova: p\.module/.test(panels) && /data-nova=\{t\.nova\}/.test(panels), "Panels.tsx: a registered panel's tab is marked");
check(/className="panel-body"[^>]*data-nova=\{own\?\.module\}/.test(panels), "Panels.tsx: a registered panel's content is marked");
check(/data-nova=\{b\.module\}/.test(read("components/BottomBar.tsx")), "BottomBar.tsx: a registered button is marked");
const bar = read("components/MenuBar.tsx");
check(/data-nova=\{it\.nova\}/.test(bar) && /data-nova=\{menuOwner\(name\)\}/.test(bar), "MenuBar.tsx: registered items and added menus are marked");
check(/data-nova=\{c\.item\.nova\}/.test(read("components/CommandPalette.tsx")), "CommandPalette.tsx: registered commands are marked");
check(/<optgroup[^>]*data-nova=\{g\.module\}/.test(read("components/Bars.tsx")), "Bars.tsx: the hoop groups of the modules are marked");

done("module marking (i.3)");
