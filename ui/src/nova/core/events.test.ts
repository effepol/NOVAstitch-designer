// Test E (approved 12/11): the event bus nova/core/events.

import { check, done } from "./testkit";
import { useStore } from "../../store";
import { on, emit } from "./events";
import { installBridge } from "./bridge";
import { registerCommand, runCommand } from "./commands";
import type { PlanData, StitchDocument } from "../../types";
import { loadDoc } from "../../lib/actions";

installBridge();
registerCommand<{ name: string }>({ id: "test.rename", label: { it: "Rinomina", en: "Rename" }, apply: (d, p): StitchDocument => ({ ...d, name: p.name }) });

const seen: { type: string; payload: unknown }[] = [];
const offs = (["command.executed", "doc.changed"] as const).map((type) => on(type, (payload) => seen.push({ type, payload })));

runCommand("test.rename", { name: "Stemma" });
const exec = seen.filter((e) => e.type === "command.executed");
const changed = seen.filter((e) => e.type === "doc.changed");
check(exec.length === 1 && JSON.stringify(exec[0].payload) === JSON.stringify({ id: "test.rename", params: { name: "Stemma" } }), `E runCommand emits command.executed {id, params} once (${JSON.stringify(exec)})`);
check(changed.length === 1 && JSON.stringify(changed[0].payload) === JSON.stringify({ commandId: "test.rename" }), `E …and doc.changed {commandId} once (${JSON.stringify(changed)})`);

// a native Filum change
seen.length = 0;
useStore.getState().commit((d) => ({ ...d, name: "Altro" }));
check(seen.length === 1 && seen[0].type === "doc.changed" && JSON.stringify(seen[0].payload) === JSON.stringify({ commandId: null }), `E a native Filum change emits doc.changed {commandId: null} (${JSON.stringify(seen)})`);

// a listener that fails does not stop the others
let reached = false;
const offBad = on("selection.changed", () => { throw new Error("broken listener"); });
const offGood = on("selection.changed", () => { reached = true; });
let threw = false;
try { emit("selection.changed", { ids: [] }); } catch { threw = true; }
check(reached && !threw, "E a listener that throws does not stop the others, nor the sender");
offBad();
offGood();

// a listener that subscribes while an event is being sent does not get that event
const late: unknown[] = [];
let offLate = () => {};
const offOuter = on("selection.changed", () => {
  offLate = on("selection.changed", (p) => late.push(p));
});
emit("selection.changed", { ids: ["a"] });
check(late.length === 0, "E a listener that subscribes during the sending does not receive that event");
offOuter();
emit("selection.changed", { ids: ["b"] });
check(late.length === 1, "E …it receives the next one");
offLate();

// Filum's own state changes reach the bus
const got: Record<string, unknown[]> = {};
const offAll = (["selection.changed", "view.changed", "plan.ready"] as const).map((type) => on(type, (p) => (got[type] ??= []).push(p)));
useStore.getState().select(["x"]);
check(JSON.stringify(got["selection.changed"]) === JSON.stringify([{ ids: ["x"] }]), "E selecting emits selection.changed {ids}");
useStore.getState().setView({ scale: 96 / 25.4 * 2, ox: 1, oy: 2 });
const v = got["view.changed"]?.[0] as { mode: string; scale: number; ox: number; oy: number; zoomFactor: number } | undefined;
check(!!v && v.mode === "vector" && v.ox === 1 && v.oy === 2 && Math.abs(v.zoomFactor - 2) < 1e-9, `E zooming emits view.changed {mode, scale, ox, oy, zoomFactor} (${JSON.stringify(v)})`);
const stats = { stitches: 10 } as unknown as PlanData["stats"];
useStore.setState({ plan: { stats } as unknown as PlanData });
check((got["plan.ready"]?.[0] as { stats: unknown } | undefined)?.stats === stats, "E a new plan emits plan.ready {stats}");
offAll.forEach((off) => off());

// opening a design emits doc.loaded (provisionally from module 0, decision 3 of 12/11)
const loaded: unknown[] = [];
const offLoaded = on("doc.loaded", (p) => loaded.push(p));
loadDoc({ ...useStore.getState().doc, objects: [] }, "/designs/Stemma.filum");
check(
  JSON.stringify(loaded) === JSON.stringify([{ path: "/designs/Stemma.filum", fromSchema: 0, migrated: false, readOnly: false, warnings: [] }]),
  `E opening a Filum design emits doc.loaded with schema 0 (${JSON.stringify(loaded)})`,
);
offLoaded();

// after unsubscribing nothing arrives
offs.forEach((off) => off());
seen.length = 0;
runCommand("test.rename", { name: "Ancora" });
check(seen.length === 0, "E after unsubscribing a listener receives nothing");

done("event bus");
