// Module b — from the trials of build 1 (Signor Poletti, 25/11):
// 1) Sequence panel colours: a lock stitch on = green, off = red; the connection icon
//    in the colours of its line (red trim, blue jump, green sewn through).
// 2) Selecting an object marks on the design the last stitch of the object before it
//    and the first stitch of the one after it, where they exist.

import { check, done } from "../core/testkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStore, planOf } from "../../store";
import type { StitchDocument } from "../../types";
import { stitchEnds } from "../../canvas/handles";
import { drawCanvasLayers, canvasLayers } from "../core/registry";
import { setLanguage } from "../core/i18n";
import { SequenceView } from "./SequencePanel";
import { registerCanvasViews } from "./canvas";
import { LINK_COLOR, TIE_COLOR, linkKinds, neighborPoints } from "./overlay";
import { abc, square } from "./fixture";
import { fullPlan } from "./dst";

setLanguage("it");
const hex = (c: string) => c.toLowerCase();
const html = (doc: StitchDocument, assisted = false) =>
  renderToStaticMarkup(createElement(SequenceView, { doc, selection: [], counts: null, assisted, kinds: linkKinds(doc, fullPlan(doc)) }));
/** The style of each button with this anchor, in row order. */
const styles = (h: string, anchor: string) => [...h.matchAll(new RegExp(`<button[^>]*data-nova-anchor="${anchor}"[^>]*>`, "g"))].map((m) => m[0].match(/style="([^"]*)"/)?.[1] ?? "");
const colorOf = (style: string) => style.match(/color:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase();

// 1) lock stitches: green when on, red when off
{
  const d = abc(false, [square("A"), square("B", { ties: "start" }), square("C", { ties: "none" })]);
  const h = html(d);
  const starts = styles(h, "b.tieStart").map(colorOf);
  const ends = styles(h, "b.tieEnd").map(colorOf);
  check(starts.join() === [TIE_COLOR.on, TIE_COLOR.on, TIE_COLOR.off].map(hex).join(), `1) start ties: on green, off red (${starts})`);
  check(ends.join() === [TIE_COLOR.on, TIE_COLOR.off, TIE_COLOR.off].map(hex).join(), `1) end ties: on green, off red (${ends})`);
  check(hex(TIE_COLOR.on) === hex(LINK_COLOR.join) && hex(TIE_COLOR.off) === hex(LINK_COLOR.trim), "1) the same green and red as the lines");
}

// 1) the connection icon in the colour of its line; faint when the program chose it
{
  // A: the program trims (faint red); B: sewn through by hand (green); C: a jump by hand (blue), then the end
  const d = abc(false, [square("A"), square("B", { link: "join" }), square("C")]);
  const kinds = linkKinds(d, fullPlan(d));
  check(kinds.get("A") === "trim" && kinds.get("B") === "join", `the plan's connections: A ${kinds.get("A")}, B ${kinds.get("B")}`);
  const links = styles(html(d), "b.trim");
  check(colorOf(links[0]) === hex(LINK_COLOR.trim) && /opacity:\s*0\.55/.test(links[0]), "1) A: the program's trim, red and faint");
  check(colorOf(links[1]) === hex(LINK_COLOR.join) && /opacity:\s*1/.test(links[1]), "1) B: sewn through by hand, green and full");
  const j = abc(false, [square("A", { link: "jump" }), square("B", { trimAfter: true }), square("C")]);
  const lj = styles(html(j), "b.trim");
  check(colorOf(lj[0]) === hex(LINK_COLOR.jump) && /opacity:\s*1/.test(lj[0]), "1) a jump by hand: blue and full");
  check(colorOf(lj[1]) === hex(LINK_COLOR.trim) && /opacity:\s*1/.test(lj[1]), "1) a trim by hand: red and full");
  const la = styles(html(j, true), "b.trim");
  check(colorOf(la[1]) === hex(LINK_COLOR.trim), "1) Assisted: the trim icon is red too");
}

// 2) the neighbours of the selected object
{
  const d = abc(false);
  const plan = fullPlan(d);
  const endOf = (i: number) => stitchEnds(plan, i)!;
  const nb = (ids: string[]) => neighborPoints(d, plan, ids);
  const b = nb(["B"]);
  check(b.prev?.objId === "A" && b.prev.n === 1 && b.prev.p[0] === endOf(0)[1][0] && b.prev.p[1] === endOf(0)[1][1], "2) B selected: the last stitch of A (the one before)");
  check(b.next?.objId === "C" && b.next.n === 3 && b.next.p[0] === endOf(2)[0][0] && b.next.p[1] === endOf(2)[0][1], "2) and the first stitch of C (the one after)");
  check(nb(["A"]).prev === null && nb(["A"]).next?.objId === "B", "2) the first object: no one before");
  check(nb(["C"]).next === null && nb(["C"]).prev?.objId === "B", "2) the last object: no one after");
  check(nb(["A", "C"]).prev === null && nb(["A", "C"]).next === null && nb([]).prev === null, "2) objects apart, or nothing selected: no marks");
  check(nb(["A", "B"]).prev === null && nb(["A", "B"]).next?.objId === "C", "2) a run of objects (a lettering): the neighbours of the run");
  // an object that sews nothing is skipped
  const e = abc(false, [square("A"), square("X", { stitch: { type: "none" } }), square("B"), square("C")]);
  check(neighborPoints(e, fullPlan(e), ["B"]).prev?.objId === "A", "2) an object that sews nothing is skipped");

  // drawn on the canvas, by module b's layer, with the neighbours' places in the sewing order
  registerCanvasViews();
  check(canvasLayers().some((l) => l.id === "b.neighbors" && l.module === "b"), "2) a canvas layer of the registry");
  useStore.getState().setDoc(d);
  planOf.set(useStore.getState().doc, fullPlan(useStore.getState().doc));
  const texts: string[] = [];
  const ctx = new Proxy({ fillText: (t: string) => texts.push(t) } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : () => {}),
    set: (o, k, v) => ((o[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  useStore.getState().select(["B"]);
  drawCanvasLayers(ctx, { scale: 4, ox: 0, oy: 0 });
  check(texts.includes("‹1") && texts.includes("3›"), `2) drawn: «‹1» before and «3›» after (${texts.join(" ")})`);
  texts.length = 0;
  useStore.getState().select([]);
  drawCanvasLayers(ctx, { scale: 4, ox: 0, oy: 0 });
  check(!texts.length, "2) nothing selected: nothing drawn");
}

done("sequence, build 1 trials");
