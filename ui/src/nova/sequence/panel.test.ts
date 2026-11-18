// Module b — the Sequence panel: registered through module 0's registry, drawn
// with texts from t("b.…") (in both catalogs) and anchors listed in anchors.json.

import { check, done } from "../core/testkit";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStore } from "../../store";
import { panels } from "../core/registry";
import { setLanguage } from "../core/i18n";
import { install } from "./install";
import { SequenceView } from "./SequencePanel";
import { abc, square } from "./fixture";
import it from "./it.json";
import en from "./en.json";
import anchors from "./anchors.json";

install();
const p = panels().find((x) => x.id === "b.sequence");
check(!!p && p.module === "b" && p.title === "b.title", "the Sequence panel is registered by module b, titled t(\"b.title\")");

// every b.* text in both languages, every key used by the code present
const dir = path.resolve(process.cwd(), "src/nova/sequence");
const code = readdirSync(dir)
  .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n");
const itKeys = Object.keys(it).sort().join();
check(itKeys === Object.keys(en).sort().join(), "it.json and en.json have the same keys");
check(Object.keys(it).every((k) => k.startsWith("b.")), "every key is b.<key>");
const used = [...code.matchAll(/t\(\s*"(b\.[\w.]+)"/g)].map((m) => m[1]);
const missing = used.filter((k) => !(k in it) || !(k in en));
check(used.length > 0 && !missing.length, `every t("b.…") of the code is in both catalogs (${missing.join(", ") || "all there"})`);
// keys built from parts: b.tieStart.on … are listed too
for (const k of ["b.tieStart.on", "b.tieStart.off", "b.tieEnd.on", "b.tieEnd.off"]) check(k in it && k in en, `${k} in both catalogs`);

// anchors: every data-nova-anchor of the code is in anchors.json, and the other way round
const inCode = new Set([...code.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]));
const listed = new Set(Object.keys(anchors));
check([...inCode].every((a) => listed.has(a) && a.startsWith("b.")), `every anchor of the code is in anchors.json (${[...inCode].filter((a) => !listed.has(a)).join(", ") || "all there"})`);
check([...listed].every((a) => inCode.has(a)), `every anchor of anchors.json is in the code (${[...listed].filter((a) => !inCode.has(a)).join(", ") || "all there"})`);

// b.1 the list shows A, B, C in sewing order
let assisted = false;
const html = () => renderToStaticMarkup(createElement(SequenceView, { doc: useStore.getState().doc, selection: [], counts: null, assisted }));
setLanguage("it");
useStore.getState().setDoc(abc(true, [square("A", { stopAfter: true }), square("B", { start: [71, 11] }), square("C")]));
const h1 = html();
const names = [...h1.matchAll(/<span class="lname" title="([^"]+)"/g)].map((m) => m[1]).join("");
check(names === "ABC", `b.1 the panel shows A, B, C (${names})`);
check((h1.match(/data-nova-anchor="b.row"/g) ?? []).length === 3, "one row per object");
check(h1.includes("Stop dopo: sì") && h1.includes("Partenza scelta a mano"), "the row icons say what they do, in Italian");
setLanguage("en");
check(html().includes("Stop after: yes"), "and in English");

// Studio: the tie icons can be clicked; Assisted: they are disabled and say why
const tieButtons = (s: string) => [...s.matchAll(/<button[^>]*data-nova-anchor="b.tie(Start|End)"[^>]*>/g)].map((m) => m[0]);
check(tieButtons(html()).length === 6 && tieButtons(html()).every((b) => !b.includes("disabled")), "Studio: the tie icons are active");
assisted = true;
const ta = tieButtons(html());
check(ta.length === 6 && ta.every((b) => b.includes("disabled") && b.includes("In Assisted")), "b.6 Assisted: the tie icons are disabled and say the ties are standard");
assisted = false;

// a lettering is one row, with its first line as the name
useStore.getState().setDoc(abc(true, [square("A"), ...["L1", "L2"].map((id) => ({ ...square("B"), id, text: { group: "g", content: "Ciao\nmondo" } as never }))]));
const h2 = html();
check((h2.match(/data-nova-anchor="b.row"/g) ?? []).length === 2 && h2.includes('title="Ciao"'), "a lettering is one row named by its first line");

// empty design
useStore.getState().setDoc(abc(true, []));
check(html().includes("No objects"), "an empty design says so");

done("sequence panel (b)");
