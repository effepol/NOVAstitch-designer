// The layers panel's tabs (module 0, note 1 on build 0.1.1, Architect 26/11):
// too many tabs for the panel. Layers and Issues (Filum's) stay as they are;
// the tabs the modules register become icons (the translated name as title
// and aria-label), without an icon they stay written; the ones that do not fit
// go into «More» (three dots), the open one always stays in view.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Frame } from "lucide-react";
import { emptyDoc, useStore } from "../../store";
import { registerPanel } from "./registry";
import { setLanguage } from "./i18n";
import { tabsInMore } from "./tabsOverflow";
import { OutlinePanel } from "../../components/Panels";
import it from "./it.json";
import en from "./en.json";

// --- which tabs go into «More»: the modules' (the last first), never the open one
const ids = ["a.hoops", "b.sequence", "f.patch", "g.lessons"];
const w = new Map(ids.map((k) => [k, 30]));
check(tabsInMore(ids, w, 200, 400, 30, "layers").length === 0, "room for every tab: no «More»");
check(tabsInMore(ids, w, 200, 290, 30, "layers").join() === "g.lessons,f.patch", "short of room: the last ones go into «More» (with room for its button)");
check(!tabsInMore(ids, w, 200, 290, 30, "g.lessons").includes("g.lessons") && tabsInMore(ids, w, 200, 290, 30, "g.lessons").join() === "f.patch,b.sequence", "the open tab stays in view, the next ones go instead");
check(tabsInMore(ids, w, 200, 100, 30, "b.sequence").join() === "g.lessons,f.patch,a.hoops", "very narrow: every module tab but the open one");
check(typeof it["core.bar.more"] === "string" && typeof en["core.bar.more"] === "string", "«Altro» / «More» from module 0's catalogue");

// --- the panel drawn with React
const doc = { ...emptyDoc() };
const show = (tab: string) => {
  useStore.setState({ doc, outlineTab: tab });
  Object.assign(useStore.getInitialState(), { doc, outlineTab: tab });
  return renderToStaticMarkup(createElement(OutlinePanel, { side: "left", mainRef: { current: null } }));
};
setLanguage("it");
const before = show("layers");
const offs = [
  registerPanel({ id: "x.hoops", module: "x", title: "core.bar.more", icon: Frame, render: () => createElement("p", null, "telai") }),
  registerPanel({ id: "y.plain", module: "y", title: "core.zoom.title", render: () => createElement("p", null, "senza icona") }),
];
for (const lang of ["it", "en"] as const) {
  setLanguage(lang);
  const html = show("layers");
  const tab = html.match(/<button[^>]*data-nova="x"[^>]*>.*?<\/button>/)?.[0] ?? "";
  const name = lang === "it" ? it["core.bar.more"] : en["core.bar.more"];
  check(/<svg/.test(tab) && !tab.replace(/<[^>]+>/g, "").trim(), `${lang}: a module tab with an icon shows the icon, no text`);
  check(tab.includes(`title="${name}"`) && tab.includes(`aria-label="${name}"`), `${lang}: its name «${name}» as title and aria-label`);
  const plain = html.match(/<button[^>]*data-nova="y"[^>]*>.*?<\/button>/)?.[0] ?? "";
  check(plain !== "" && !/<svg/.test(plain) && plain.replace(/<[^>]+>/g, "").trim().length > 0, `${lang}: without an icon the tab stays written`);
}
setLanguage("it");
const layersTab = (h: string) => h.match(/<button[^>]*role="tab"[^>]*>.*?<\/button>/g)?.slice(0, 2).join("") ?? "";
check(layersTab(show("layers")) === layersTab(before), "Layers and Issues (Filum's) as they were, with their counters");
check(show("x.hoops").includes("telai"), "a module tab opens its panel");
for (const off of offs) off();
check(show("layers") === before, "no module tabs: the panel as before");

const panels = readFileSync(path.join(process.cwd(), "src", "components", "Panels.tsx"), "utf8");
check(/tabsInMore\(/.test(panels) && /ResizeObserver/.test(panels), "the tabs are measured again when the panel's width changes");
check(/data-nova="core"[^>]*\n?[^>]*bb-overflow|bb-overflow[^>]*data-nova="core"/.test(panels) || /<MoreMenu/.test(panels), "«More» is module 0's (data-nova)");
const reg = readFileSync(path.join(process.cwd(), "src", "nova", "core", "registry.ts"), "utf8");
check(/icon\?: ComponentType<\{ size\?: number \}>;/.test(reg.slice(reg.indexOf("export interface PanelEntry"), reg.indexOf("export interface PanelEntry") + 400)), "PanelEntry has an optional icon");
for (const [f, icon] of [["hoops", "Frame"], ["sequence", "ListOrdered"], ["edit", "Shield"], ["lessons", "GraduationCap"]]) {
  const src = readFileSync(path.join(process.cwd(), "src", "nova", f, "install.ts"), "utf8");
  check(new RegExp(`registerPanel\\(\\{[^\\n]*icon: ${icon}`).test(src), `${f}/install.ts: the panel's icon (${icon})`);
}

done("schede del pannello come icone");
