// Contract test j.13 (module j; Signor Poletti, 25/11), the interface's part:
// the appliqué's placement and tack-down are sewn in the «Appliqué» thread the
// program adds (a colour the design does not use), the cover in the object's
// thread — and the «Appliqué» thread is on the work sheet (PDF). The plan's
// commands and the exported DST (trim + stop after the placement, trim +
// colour change after the tack-down) are checked by cargo test,
// crates/core/src/stitches/applique.rs j13_….

import { check, done } from "../core/testkit";
import { PDFDocument } from "pdf-lib";
import { setLanguage } from "../core/i18n";
import { defaultStitch, rectPath } from "../../lib/geometry";
import { FLAG, type DesignObject } from "../../types";
import { design, planOf, thread } from "../worksheet/testkit";
import { sheetData } from "../worksheet/sheetData";
import { layoutSheet, type Item } from "../worksheet/layout";
import { sheetPdf } from "../worksheet/pdf";

(async () => {
  setLanguage("it");
  const applique: DesignObject = { id: "ap", name: "Toppa", thread: "A", visible: true, locked: false, trimAfter: false, stopAfter: false, paths: [rectPath(10, 10, 30, 30)], stitch: defaultStitch("applique") };
  const d = design([applique], [thread("A", "#cc0000", { name: "Rosso" })]);
  const plan = planOf(d);

  // the plan: two threads, «Appliqué» first in a colour the design does not use
  check(plan.threads.length === 2 && plan.threads[0].name === "Appliqué" && plan.threads[1].id === "A", `fili del piano: ${plan.threads.map((t) => t.name).join(", ")}`);
  check(plan.threads[0].color.toLowerCase() !== "#cc0000", "il filo «Appliqué» ha un colore non usato nel lavoro");
  const cmds = [...plan.flags].map((f) => f & (FLAG.TRIM | FLAG.STOP | FLAG.COLOR_CHANGE)).filter((f) => f);
  check(cmds.join() === [FLAG.TRIM, FLAG.STOP, FLAG.TRIM, FLAG.COLOR_CHANGE, FLAG.TRIM].join(), "rasafilo + stop dopo il posizionamento, rasafilo + cambio colore dopo il tack-down");

  // the work sheet: a row for «Appliqué», then the object's thread
  const data = sheetData(d, plan, "toppa.dst");
  check(data.rows.length === 2 && data.rows[0].thread.name === "Appliqué" && data.rows[1].thread.name === "Rosso", `righe della scheda: ${data.rows.map((r) => r.thread.name).join(", ")}`);
  const texts = layoutSheet(data, plan).pages.flat().filter((i): i is Extract<Item, { k: "text" }> => i.k === "text").map((i) => i.text);
  check(texts.some((x) => x.includes("Appliqué")) && texts.some((x) => x.includes("Rosso")), "nella scheda PDF: il filo «Appliqué» e quello dell'oggetto");
  const pdf = await PDFDocument.load(await sheetPdf(data, plan));
  check(pdf.getPageCount() >= 1, "il PDF si genera");

  done("j.13 appliqué: filo «Appliqué», stop e cambio colore");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
