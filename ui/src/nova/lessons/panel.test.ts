// Module g — the interface, through module 0's registry: the Lessons panel (list,
// box of the current step with its hint, Reset and Next), the Help menu item,
// the highlight of the anchor (a style rule) and of an object (a canvas layer).
// Texts from t("g.…") in both catalogs; anchors listed in anchors.json.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, useStore } from "../../store";
import { installBridge } from "../core/bridge";
import { getLanguage, setLanguage } from "../core/i18n";
import { canvasLayers, menuItems, panels } from "../core/registry";
import { defaultStitch } from "../../lib/geometry";
import type { DesignObject } from "../../types";
import { currentStep, nextStep, startLesson, stopLesson } from "./engine";
import { anchorRule, drawObjectHighlight } from "./highlight";
import { installLessons, installLessonsUi, LESSONS_PANEL } from "./install";
import { LessonsView } from "./LessonsPanel";
import it from "./it.json";
import en from "./en.json";
import anchors from "./anchors.json";

installBridge();
const tick = () => new Promise((r) => setTimeout(r, 0));
const st = () => useStore.getState();

const dir = path.resolve(process.cwd(), "src/nova/lessons");
const code = readdirSync(dir)
  .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n");
check(Object.keys(it).sort().join() === Object.keys(en).sort().join(), "it.json and en.json have the same keys");
check(Object.keys(it).every((k) => k.startsWith("g.")), "every key is g.<key>");
const used = [...code.matchAll(/t\(\s*"(g\.[\w.]+)"/g)].map((m) => m[1]);
const missing = used.filter((k) => !(k in it) || !(k in en));
check(used.length > 0 && !missing.length, `every t("g.…") of the code is in both catalogs (${missing.join(", ") || "all there"})`);
for (const p of ["theory", "vector", "image", "tips"]) check(`g.path.${p}` in it && `g.path.${p}` in en, `the path ${p} has its name in both catalogs`);
// the validator's messages: every g.err.<key> the code asks for
const errKeys = [...code.matchAll(/err\("(\w+)"/g)].map((m) => `g.err.${m[1]}`);
check(errKeys.length > 10 && errKeys.every((k) => k in it && k in en), `every validator message is in both catalogs (${errKeys.filter((k) => !(k in it)).join(", ") || "all there"})`);

const inCode = new Set([...code.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]));
const listed = new Set(Object.keys(anchors));
check([...inCode].every((a) => listed.has(a) && a.startsWith("g.")), `every anchor of the code is in anchors.json (${[...inCode].filter((a) => !listed.has(a)).join(", ") || "all there"})`);
check([...listed].every((a) => inCode.has(a)), `every anchor of anchors.json is in the code (${[...listed].filter((a) => !inCode.has(a)).join(", ") || "all there"})`);

const satin = (id: string, width: number): DesignObject => ({
  id,
  name: id,
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: false, nodes: [{ p: [10, 10] }, { p: [40, 10] }] }],
  stitch: { ...(defaultStitch("satin") as DesignObject["stitch"] & { type: "satin" }), width },
});
const start = { ...emptyDoc(), objects: [satin("o1", 2)] };
const lesson = {
  id: "ui",
  rev: 1,
  path: "vector",
  title: { it: "Prova dell'interfaccia", en: "Interface test" },
  modes: ["studio"],
  startDesign: "start.nsd",
  steps: [
    {
      id: "a",
      text: { it: "Allarga il satin a 4 mm.", en: "Widen the satin to 4 mm." },
      highlight: "g.next",
      check: { exists: { type: "satin", param: { width: { min: 3, max: 5 } } } },
      hint: { it: "Ancora no.", en: "Not yet." },
      reset: "step",
    },
    { id: "b", text: { it: "Guarda il satin.", en: "Look at the satin." }, highlight: { object: "o1" }, hint: { it: "Premi Avanti.", en: "Press Next." }, reset: "start" },
  ],
};

async function main() {
  const offUi = installLessonsUi();
  const offLessons = await installLessons({ builtin: { ui: { "lesson.json": JSON.stringify(lesson), "start.nsd": JSON.stringify(start) } }, reader: null, store: null, anchors: new Set(Object.keys(anchors)) });

  const p = panels().find((x) => x.id === LESSONS_PANEL);
  check(!!p && p.module === "g" && p.title === "g.panel.title", "the Lessons panel is registered by module g");
  const m = menuItems().find((x) => x.id === "g.lessons");
  check(!!m && m.menu === "Help" && m.label === "g.menu.lessons", "Help ▸ Lessons is registered");
  m!.run();
  check(st().outlineTab === LESSONS_PANEL, "Help ▸ Lessons opens the Lessons tab");
  check(canvasLayers().some((l) => l.id === "g.highlight"), "the object highlight is a registered canvas layer");

  const html = () => renderToStaticMarkup(createElement(LessonsView, { lang: getLanguage() }));
  setLanguage("it");
  const list = html();
  check(list.includes("Disegno vettoriale") && list.includes("Prova dell&#x27;interfaccia") && list.includes("Inizia") && list.includes('data-nova-anchor="g.panel"'), "the list: the path, the lesson, Start");
  setLanguage("en");
  check(html().includes("Vector drawing") && html().includes("Interface test"), "the list in English");

  startLesson("ui", { confirm: () => true });
  await tick();
  setLanguage("it");
  let box = html();
  check(box.includes("Passo 1 di 2") && box.includes("Allarga il satin a 4 mm.") && box.includes("Ripristina") && box.includes("Avanti") && !box.includes("Ancora no."), "the step box: text, Reset, Next, no hint yet");
  check(anchorRule("g.next").startsWith('[data-nova-anchor="g.next"]') && anchorRule("g.next").includes("var(--accent)"), "the anchor is outlined in the accent colour");

  // the hint shows once the check does not pass
  st().commit((d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, stitch: { ...o.stitch, width: 6 } as DesignObject["stitch"] })) }));
  await tick();
  box = html();
  check(box.includes("Ancora no.") && box.includes('data-nova-anchor="g.hint"'), "the hint shows when the check does not pass");
  setLanguage("en");
  check(html().includes("Not yet.") && html().includes("Step 1 of 2"), "the step box follows the language");

  st().commit((d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, stitch: { ...o.stitch, width: 4 } as DesignObject["stitch"] })) }));
  await tick();
  check(currentStep()?.step.id === "b", "second step");
  // the object's frame on the canvas
  const calls: string[] = [];
  const ctx = new Proxy({}, { get: (_t, k) => (typeof k === "string" && /^[a-z]/.test(k) && k !== "strokeStyle" && k !== "lineWidth" ? (...a: unknown[]) => calls.push(`${k}(${a.join(",")})`) : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
  drawObjectHighlight(ctx, { scale: 4, ox: 0, oy: 0 }, st().doc, { object: "o1" }, "#cc1219");
  check(calls.some((c) => c.startsWith("strokeRect(")), `an object step draws a frame around the object (${calls.join(" ")})`);
  calls.length = 0;
  drawObjectHighlight(ctx, { scale: 4, ox: 0, oy: 0 }, st().doc, "g.next", "#cc1219");
  check(calls.length === 0, "an anchor step draws nothing on the canvas");

  // the Next button ends a reading step; the done box offers the list again
  nextStep();
  setLanguage("it");
  box = html();
  check(box.includes("Lezione completata.") && box.includes("Torna all&#x27;elenco"), "the lesson completed: the box says so");
  stopLesson();
  check(html().includes("Inizia"), "leaving: the list again");

  // a refused lesson is named in the panel (who writes lessons sees why)
  offUi();
  offLessons();
  await installLessons({ builtin: { ui: { "lesson.json": "{" } }, reader: null, store: null, anchors: new Set() });
  installLessonsUi();
  setLanguage("it");
  check(html().includes("Lezioni rifiutate: 1") && html().includes("Lezione «ui» rifiutata"), "a refused lesson is listed with its reason");
  check(html().includes("Nessuna lezione per ora"), "no lesson: the panel says how to add one");
  done("lessons panel");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
