// Module b, part 2 — tests b.11–b.15 (contract, section 4, «b, parte 2», with Signor
// Poletti's change of 18/11): the connection after an object, chosen from the menu
// Trim / Jump / Sew through / Automatic, on module 0's link field and plan.links.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStore } from "../../store";
import type { StitchDocument } from "../../types";
import { runCommand } from "../core/commands";
import { setModeSource } from "../core/mode";
import { setLanguage } from "../core/i18n";
import { readProject } from "../format/read";
import { nsdText } from "../format/serialize";
import { linkChoice, registerSequenceCommands } from "./commands";
import { uncoveredJoins } from "./rows";
import { SequenceView, linkMenu } from "./SequencePanel";
import { abc, AT } from "./fixture";
import { dstTrims, exportDst, fullPlan, type DstRecord } from "./dst";

registerSequenceCommands();
setLanguage("it");
const s = () => useStore.getState();
const doc = () => s().doc;
const obj = (id: string) => doc().objects.find((o) => o.id === id)!;
const start = (d: StitchDocument) => s().setDoc(d);
const trims = (d: StitchDocument = doc()) => fullPlan(d).stats.trims;
const linkAB = (d: StitchDocument = doc()) => fullPlan(d).links?.find((l) => l.from === 0 && l.to === 1);
const samePlan = (a: StitchDocument, b: StitchDocument) => {
  const p = fullPlan(a);
  const q = fullPlan(b);
  return p.flags.length === q.flags.length && p.flags.every((f, i) => f === q.flags[i] && p.coords[2 * i] === q.coords[2 * i] && p.coords[2 * i + 1] === q.coords[2 * i + 1]);
};
// the DST between the last stitch of A and the first of B (A at x 10–20, B at x 70–80 mm, top row)
const between = (recs: DstRecord[]) => {
  const st = recs.filter((r) => r.kind === "stitch");
  const ox = Math.min(...st.map((r) => r.x)) - AT.A[0] * 10;
  const inA = (r: DstRecord) => r.kind === "stitch" && r.x - ox <= (AT.A[0] + 10) * 10 + 10;
  const inB = (r: DstRecord) => r.kind === "stitch" && r.x - ox >= AT.B[0] * 10 - 10 && r.y - (Math.min(...st.map((q) => q.y))) <= 110;
  const a = recs.map((r, i) => (inA(r) ? i : -1)).reduce((x, y) => Math.max(x, y));
  const b = recs.findIndex((r, i) => i > a && inB(r));
  return { a, b, recs: recs.slice(a, b + 1) };
};

setModeSource(() => "studio");
const plain = abc(false); // the machine trims every gap: 3 trims (A→B, B→C, the end)
const t0 = trims(plain);
check(t0 === 3 && linkAB(plain)?.kind === "trim" && !linkAB(plain)?.manual, `(the design trims A→B on its own: ${t0} trims)`);

// the menu: four entries, the one in force checked, marked as module b's
{
  const items = linkMenu("A", "auto").filter((i): i is Exclude<typeof i, "-"> => i !== "-");
  check(items.map((i) => i.label).join(",") === "Rasafilo,Salto,Cucitura,Automatico", `the menu offers Rasafilo / Salto / Cucitura / Automatico (${items.map((i) => i.label)})`);
  check(items.filter((i) => i.checked).map((i) => i.label).join() === "Automatico" && items.every((i) => i.nova === "b"), "the entry in force is checked; the entries carry module b's mark");
}
const choose = (id: string, label: string) => {
  const o = doc().objects.find((x) => x.id === id)!;
  const item = linkMenu(id, linkChoice(o)).find((i) => i !== "-" && i.label === label);
  if (item && item !== "-") item.run!();
};

// b.11 «Cucitura» (join): link = "join"; trims − 1; the connection in 2.5 mm running stitches; one undo takes it away
start(plain);
let steps = s().past.length;
choose("A", "Cucitura");
check(obj("A").link === "join" && !obj("A").trimAfter && s().past.length === steps + 1, "b.11 A.link = \"join\", one undo step");
check(trims() === t0 - 1, `b.11 one trim less (${trims()} of ${t0})`);
check(linkAB()?.kind === "sew" && !!linkAB()?.manual, "b.11 the plan sews A→B, chosen by hand");
{
  const { a, b, recs } = between(exportDst(doc()));
  const steps25 = recs.slice(1).map((r, i) => Math.hypot(r.x - recs[i].x, r.y - recs[i].y));
  check(a >= 0 && b > a && recs.every((r) => r.kind === "stitch"), "b.11 in the DST: only stitches from A to B, no trim, no jump");
  check(steps25.length > 3 && steps25.every((d) => d <= 26), `b.11 the connection is sewn in stitches of 2.5 mm at most (longest ${Math.max(...steps25).toFixed(0)} × 0.1 mm)`);
}
s().undo();
check(obj("A").link === undefined && trims() === t0, "b.11 one undo takes the link away");

// b.12 «Salto» (jump): link = "jump"; no trim, a jump
choose("A", "Salto");
check(obj("A").link === "jump" && trims() === t0 - 1 && linkAB()?.kind === "jump" && !!linkAB()?.manual, "b.12 A.link = \"jump\": no trim, the plan jumps A→B");
{
  const { recs } = between(exportDst(doc()));
  check(recs.some((r) => r.kind === "jump") && dstTrims(recs).length === 0, "b.12 in the DST: a jump from A to B, no trim");
}
// (that the jump counts in the thread metres is module l's test)

// «Rasafilo»: trimAfter, link gone
choose("A", "Rasafilo");
check(obj("A").trimAfter === true && obj("A").link === undefined && linkAB()?.kind === "trim" && !!linkAB()?.manual, "Rasafilo: A.trimAfter = true, no link; the trim is chosen by hand");

// b.13 «Automatico» after b.11: link and trimAfter gone; the plan as before
start(plain);
choose("A", "Cucitura");
choose("A", "Automatico");
check(!("link" in obj("A")) && obj("A").trimAfter === false, "b.13 link and trimAfter absent");
check(samePlan(doc(), plain), "b.13 the plan is as before");
steps = s().past.length;
choose("A", "Automatico");
check(s().past.length === steps, "the entry already in force changes nothing (no undo step)");

// b.14 join on a connection that stays uncovered: a warning on the object, in Studio
start(plain);
choose("A", "Cucitura");
const html = (assisted: boolean) =>
  renderToStaticMarkup(createElement(SequenceView, { doc: doc(), selection: [], counts: null, assisted, warnings: uncoveredJoins(doc(), fullPlan(doc()), assisted) }));
check(!!linkAB()?.visible, "(nothing covers the connection A→B)");
check(uncoveredJoins(doc(), fullPlan(doc()), false).has("A") && html(false).includes('data-nova-anchor="b.joinWarning"') && html(false).includes("resta scoperta"), "b.14 Studio: a warning on A, «la cucitura … resta scoperta»");
check(!uncoveredJoins(plain, fullPlan(plain), false).size, "b.14 no warning without a join chosen by hand");
check(!html(true).includes("b.joinWarning"), "b.14 Assisted: no warning (the program decides)");
// Assisted: no menu, the command changes nothing
setModeSource(() => "assisted");
const before = doc();
runCommand("b.setLink", { id: "B", link: "jump" });
check(doc() === before && !html(true).includes('aria-haspopup="menu"'), "Assisted: no menu, b.setLink changes nothing");
setModeSource(() => "studio");
check(html(false).includes('aria-haspopup="menu"'), "Studio: the row's connection icon opens the menu");

// b.15 saved and reopened (.nsd): link stays; a file without link sews as Filum
{
  const back = readProject("Sequenza.nsd", new TextEncoder().encode(nsdText(doc()))).doc;
  check(back.objects[0].link === "join" && samePlan(back, doc()), "b.15 link stays in the .nsd and sews the same");
  const none = readProject("Sequenza.nsd", new TextEncoder().encode(nsdText(plain))).doc;
  check(!nsdText(plain).includes('"link"') && none.objects.every((o) => o.link === undefined) && samePlan(none, plain), "b.15 a file without link has none and sews as Filum");
}
setModeSource(null);

done("sequence connections (b.11–b.15)");
