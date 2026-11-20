// Lesson anchors on the registered menu items (module 0, request of 19/11
// evening): MenuItemEntry has an optional anchor, which becomes the item's
// data-nova-anchor in Filum's menus (as for the bar buttons, PR #51).

import { check, done } from "./testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerMenuItem } from "./registry";
import { buildMenus } from "../../components/menuModel";
import { Menu } from "../../components/MenuBar";

const offs = [
  registerMenuItem({ id: "g.lessons", module: "g", menu: "Help", label: "Lezioni guidate", run: () => {}, anchor: "g.menu.lessons" }),
  registerMenuItem({ id: "g.plain", module: "g", menu: "Help", label: "Senza ancora", run: () => {} }),
];
const help = buildMenus().Help;
const html = renderToStaticMarkup(createElement(Menu, { items: help, x: 0, y: 0, onClose: () => {} }));
const button = (label: string) => html.match(new RegExp(`<button[^>]*>(<[^>]+>)*[^<]*${label}`))?.[0] ?? "";
check(/data-nova="g"/.test(button("Lezioni guidate")) && /data-nova-anchor="g\.menu\.lessons"/.test(button("Lezioni guidate")), "a registered item's anchor is its data-nova-anchor (and data-nova as before)");
check(button("Senza ancora") !== "" && !/data-nova-anchor/.test(button("Senza ancora")), "no anchor: no data-nova-anchor");
check((html.match(/data-nova-anchor/g) ?? []).length === 1, "Filum's own items have none");
for (const off of offs) off();

done("ancore nel registro dei menu");
