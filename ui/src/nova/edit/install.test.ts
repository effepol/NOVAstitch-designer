// Module f in the app: the panel and the menu item come from module 0's
// registry, every lesson anchor is listed in anchors.json, every text has both languages.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { useStore, emptyDoc } from "../../store";
import { menuItems, panels } from "../core/registry";
import { setLanguage, t } from "../core/i18n";
import { installPatch } from "./install";
import { installLibrary } from "./installLibrary";
import it from "./it.json";
import en from "./en.json";

const here = (f: string) => path.resolve(process.cwd(), "src", "nova", "edit", f);
const off = installPatch();

check(panels().some((p) => p.module === "f" && p.id === "f.patch"), "module f adds the Patch panel through the registry");
const item = menuItems().find((m) => m.id === "f.patch.create");
check(!!item && item.module === "f" && item.label === "f.patch.menu", "module f adds «Create patch from selection» through the registry");
const offLib = installLibrary({ manifest: { schemaVersion: 1, items: [] }, files: {} });
check(menuItems().some((m) => m.id === "f.library.insert" && m.label === "f.library.menu") && !panels().some((p) => p.id === "f.library"), "module f adds the Library menu item through the registry (its section is in the Patch panel)");
offLib();
useStore.getState().setDoc(emptyDoc());
useStore.getState().set({ selection: [] });
check(item?.disabled?.() === true, "the menu item is off with nothing selected");

const anchors = JSON.parse(readFileSync(here("anchors.json"), "utf8"));
const src = readdirSync(here(".")).filter((f) => f.endsWith(".tsx")).map((f) => readFileSync(here(f), "utf8")).join("\n");
const used = [...new Set([...src.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]))];
check(used.length > 0 && used.every((a) => a in anchors) && Object.keys(anchors).every((a) => used.includes(a)), `every lesson anchor of the panels is in anchors.json (${used.join(", ")})`);
check(Object.keys(anchors).every((a) => a.startsWith("f.")), "the anchors are module f's");

const keys = (o: Record<string, string>) => Object.keys(o).sort().join();
check(keys(it) === keys(en) && Object.keys(it).every((k) => k.startsWith("f.")), "it.json and en.json have the same f.* keys");
// keys built from a value (order, grouping) exist too
for (const k of ["f.patch.order.rows", "f.patch.order.serpentine", "f.patch.grouping.byColor", "f.patch.grouping.byCopy"]) check(k in it && k in en, `${k} is in both catalogs`);
setLanguage("it");
check(t("f.patch.menu") === "Crea toppe dalla selezione", "Italian text from the catalog");
setLanguage("en");

off();
check(!panels().some((p) => p.id === "f.patch") && !menuItems().some((m) => m.id === "f.patch.create"), "uninstalling removes the panel and the menu item");
done("module f in the app");
