// Width of the registered panels (module 0, request of 19/11 evening, reported
// by module g): the side panel's column was as wide as the row of tabs (with
// the modules' tabs about 418 px or more) while about 248 px show, so a
// registered panel was cut on the right. Now the column is the panel's own
// width (and follows it when the panel is widened), the row of tabs scrolls
// sideways when the tabs do not fit. With Filum's tabs alone nothing changes:
// they fit. Checked in the real program too (see the PR).

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.join(process.cwd(), "src", "styles.css"), "utf8");
const rule = (sel: string) => {
  const re = new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[2]).join(";");
};
check(/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(rule(".side-panel.outline")), "the layers side panel: one column as wide as the panel (minmax(0, 1fr)), not as the row of tabs");
check(/overflow-x:\s*auto/.test(rule(".side-panel.outline .ptabs")), "its row of tabs scrolls sideways when the tabs do not fit");
check(/flex:\s*none/.test(rule(".side-panel.outline .ptab")), "the tabs keep their width (the row scrolls, the tabs do not squash)");
check(/min-width:\s*0/.test(rule(".side-panel.outline .panel-body")), "the panel body takes the column's width");
// Filum's own rules are as they were
check(/grid-template-rows:\s*28px minmax\(0, 1fr\)/.test(rule(".side-panel")) && !/grid-template-columns/.test(rule(".side-panel")), "Filum's .side-panel rule unchanged");
check(!/overflow/.test(rule(".ptabs")), "Filum's .ptabs rule unchanged");

done("larghezza dei pannelli registrati");
