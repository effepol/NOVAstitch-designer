// Module b, part 2 — tests b.9 and b.10 (contract, section 4, «b, parte 2»; Signor
// Poletti's change of 18/11: «Connections» in place of «Trims»).

import { check, done } from "../core/testkit";
import { useStore, planOf } from "../../store";
import { FLAG, type PlanData } from "../../types";
import { openPrefs, type PrefsStore } from "../core/prefs";
import { drawCanvasLayers, toolbarButtons, canvasLayers } from "../core/registry";
import { registerCanvasViews } from "./canvas";
import { isOn, loadViewOptions, PREF_KEY } from "./view";
import { connections, LINK_COLOR } from "./overlay";
import { abc, square } from "./fixture";
import { fullPlan } from "./dst";
import it from "./it.json";
import en from "./en.json";

// the app's settings file, in memory
const files = new Map<string, string>();
const mem: PrefsStore = {
  read: async (n) => files.get(n) ?? null,
  write: async (n, t) => void files.set(n, t),
  rename: async (a, b) => {
    files.set(b, files.get(a)!);
    files.delete(a);
  },
};

/** A canvas that notes what is drawn: texts and the colour of every stroke. */
function recorder() {
  const texts: string[] = [];
  const strokes: string[] = [];
  const ctx: Record<string, unknown> = {
    strokeStyle: "",
    fillStyle: "",
    fillText: (t: string) => texts.push(t),
    stroke: () => strokes.push(String(ctx.strokeStyle)),
  };
  const proxy = new Proxy(ctx, { get: (o, k) => (k in o ? o[k as string] : () => {}), set: (o, k, v) => ((o[k as string] = v), true) });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, texts, strokes };
}
const draw = () => {
  const r = recorder();
  drawCanvasLayers(r.ctx, { scale: 4, ox: 0, oy: 0 });
  return r;
};
const button = (id: string) => toolbarButtons().find((b) => b.id === id)!;
const settle = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  loadViewOptions(await openPrefs(mem));
  const off = registerCanvasViews();
  check(!!button("b.startEnd") && !!button("b.links") && button("b.startEnd").module === "b" && button("b.links").module === "b", "the two buttons come from module 0's registry, module b");
  check(canvasLayers().some((l) => l.id === "b.startEnd" && l.module === "b") && canvasLayers().some((l) => l.id === "b.links" && l.module === "b"), "the two layers are canvas layers of the registry");
  for (const k of ["b.view.startEnd", "b.view.startEnd.title", "b.view.links", "b.view.links.title"]) check(k in it && k in en, `${k} in both catalogs`);
  check(en["b.view.startEnd"] === "Start and end" && it["b.view.startEnd"] === "Partenza e arrivo" && it["b.view.links"] === "Collegamenti", "the buttons say «Partenza e arrivo» and «Collegamenti»");

  const doc = abc(false);
  useStore.getState().setDoc(doc);
  planOf.set(useStore.getState().doc, fullPlan(useStore.getState().doc));
  const steps = useStore.getState().past.length;

  // b.9 «Start and end»: off at first; on → S and E with the sewing order on every object; off → gone; the state stays
  check(!isOn("startEnd") && !isOn("links") && !button("b.startEnd").active!(), "b.9 off by default");
  check(draw().texts.length === 0, "b.9 off: nothing drawn");
  button("b.startEnd").run();
  await settle();
  const on = draw().texts;
  const count = (t: string) => on.filter((x) => x === t).length;
  check(count("S") === 3 && count("E") === 3, `b.9 on: an S and an E on every object (${count("S")} S, ${count("E")} E)`);
  check(count("1") === 2 && count("2") === 2 && count("3") === 2, "b.9 each with its place in the sewing order (1, 2, 3)");
  check(button("b.startEnd").active!(), "b.9 the button shows it is on");
  button("b.startEnd").run();
  await settle();
  check(draw().texts.length === 0 && !button("b.startEnd").active!(), "b.9 off: the marks are gone");
  button("b.startEnd").run();
  await settle();
  check(JSON.parse(files.get("nova-prefs.json") ?? "{}").values?.[PREF_KEY.startEnd] === true, "b.9 saved in the app's settings (nova-prefs.json)");
  check(useStore.getState().past.length === steps && !JSON.stringify(useStore.getState().doc).includes("startEnd"), "b.9 not in the document, no undo step");
  // reopening the program: the settings are read again
  loadViewOptions(await openPrefs(mem));
  check(isOn("startEnd") && !isOn("links"), "b.9 reopened: the state stays");

  // a mark set by hand is full, an automatic one faint (both drawn)
  useStore.getState().setDoc(abc(false, [square("A", { start: [12, 12] }), square("B"), square("C")]));
  planOf.set(useStore.getState().doc, fullPlan(useStore.getState().doc));
  check(draw().texts.filter((t) => t === "S").length === 3, "b.9 a start set by hand is drawn too");
  button("b.startEnd").run();
  await settle();

  // b.10 «Connections»: one red line for every trim of the plan; the count = PlanStats.trims
  button("b.links").run();
  await settle();
  check(isOn("links"), "b.10 the Connections button turns the lines on");
  for (const [name, d] of [
    ["the machine trims every gap", abc(false)],
    ["sewn through, a trim asked after B", abc(true, [square("A"), square("B", { trimAfter: true }), square("C")])],
    ["sewn through", abc(true)],
  ] as const) {
    useStore.getState().setDoc(d);
    const plan = fullPlan(useStore.getState().doc);
    planOf.set(useStore.getState().doc, plan);
    const red = draw().strokes.filter((s) => s === LINK_COLOR.trim).length;
    check(red === plan.stats.trims && red > 0, `b.10 ${name}: ${red} red lines = PlanStats.trims (${plan.stats.trims})`);
  }
  // sewn through: green between the objects; the trim asked by hand is full, the program's faint
  {
    const d = abc(true, [square("A"), square("B", { trimAfter: true }), square("C")]);
    const list = connections(d, fullPlan(d));
    const kinds = list.map((c) => `${c.kind}${c.manual ? "!" : ""}:${c.objId ?? "-"}`).join(" ");
    check(kinds === "join:A trim!:B trim:C", `b.10 A→B sewn (green), B→C the trim asked on B (full), the design's last trim (faint) (${kinds})`);
  }
  // a jump between two objects is blue (a plan made by hand: stitch, jump, stitch)
  {
    const p = { coords: new Float32Array([0, 0, 1, 0, 5, 0, 6, 0]), flags: new Uint8Array([0, 0, FLAG.JUMP, 0]), objects: new Uint32Array([0, 0, 1, 1]) } as unknown as PlanData;
    const list = connections(abc(true, [square("A"), square("B")]), p);
    check(list.length === 1 && list[0].kind === "jump" && list[0].objId === "A" && list[0].from[0] === 1 && list[0].to?.[0] === 6, "b.10 a jump between two objects is a blue line from the end of one to the start of the next");
  }
  button("b.links").run();
  await settle();
  check(draw().strokes.length === 0, "b.10 off: no lines");

  off();
  check(!toolbarButtons().some((b) => b.module === "b"), "removing the views takes the buttons away");
  done("sequence views (b.9, b.10)");
})();
