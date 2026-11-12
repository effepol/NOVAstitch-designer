// Contract tests a.10 and a.11 (module a, hoops): the user's own hoop list
// (user-hoops.json in the app's config folder), the commands a.hoop.select and
// a.hoop.custom, and nova.hoopKind ("cap" only for cap frames).

import { check, done } from "../core/testkit";
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useStore } from "../../store";
import { on } from "../core/events";
import { getCommand, runCommand } from "../core/commands";
import type { PrefsStore } from "../core/prefs";
import { HOOPS } from "../../lib/hoops";
import { MACHINES } from "../../lib/machines";
import { installHoops, presetHoops, USER_HOOPS_FILE } from "./hoops";
import { CAP_FRAMES, CAP_HOOPS } from "./capHoops";
import { openPrefs, PREFS_FILE } from "../core/prefs";
import { openUserHoops } from "./userHoops";
import type { StitchDocument } from "../../types";

const dir = mkdtempSync(path.join(tmpdir(), "nova-hoops-"));
const disk: PrefsStore = {
  read: async (n) => (existsSync(path.join(dir, n)) ? readFileSync(path.join(dir, n), "utf8") : null),
  write: async (n, t) => writeFileSync(path.join(dir, n), t),
  rename: async (a, b) => renameSync(path.join(dir, a), path.join(dir, b)),
  remove: async (n) => rmSync(path.join(dir, n), { force: true }),
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const state = () => useStore.getState();

(async () => {
  // module 0's single settings, in the same config folder
  await (await openPrefs(disk)).set("grid.step", 2);
  const hoops = await openUserHoops(disk);
  const off = installHoops(hoops);
  check(!!getCommand("a.hoop.select") && !!getCommand("a.hoop.custom"), "the commands a.hoop.select and a.hoop.custom are registered");
  const changes: unknown[] = [];
  const offEv = on("userHoops.changed", (p) => changes.push(p));

  // ---- a.10: the user's hoop «Mio 15×25», 150 × 250, rectangular, then a.hoop.select
  const id = await hoops.add({ name: "Mio 15×25", width: 150, height: 250, shape: "rect", kind: "flat" });
  check(typeof id === "string" && id.length > 0 && hoops.list().length === 1, `a.10 the hoop is in the list, with an id (${id})`);
  check(changes.length === 1 && same(changes[0], { hoops: hoops.list() }), "adding emits userHoops.changed with the list");
  check(readdirSync(dir).sort().join() === [PREFS_FILE, USER_HOOPS_FILE].sort().join() && USER_HOOPS_FILE === "user-hoops.json", `a.16 the list is saved in its own user-hoops.json, no temporary left (${readdirSync(dir).join()})`);
  const file = JSON.parse(readFileSync(path.join(dir, USER_HOOPS_FILE), "utf8"));
  check(file.schemaVersion === 1 && file.hoops[0].name === "Mio 15×25" && file.hoops[0].id === id, "user-hoops.json has its schemaVersion and the hoop");

  // a.16: the user's hoop is in user-hoops.json, with its schemaVersion; nova-prefs.json does not change
  const prefsBefore = readFileSync(path.join(dir, PREFS_FILE), "utf8");
  await hoops.add({ name: "Altro", width: 100, height: 100, shape: "oval", kind: "flat" });
  check(readFileSync(path.join(dir, PREFS_FILE), "utf8") === prefsBefore, "a.16 nova-prefs.json is unchanged");
  check(JSON.parse(readFileSync(path.join(dir, USER_HOOPS_FILE), "utf8")).hoops.length === 2, "a.16 the second hoop is in user-hoops.json");
  await hoops.remove(hoops.list()[1].id, () => true);
  changes.length = 1;

  const past = state().past.length;
  runCommand("a.hoop.select", { source: "user", id });
  check(same(state().doc.hoop, { name: "Mio 15×25", width: 150, height: 250 }), `a.10 doc.hoop = {name: "Mio 15×25", width: 150, height: 250} (${JSON.stringify(state().doc.hoop)})`);
  check(state().doc.nova?.hoopRef?.id === id && state().doc.nova?.hoopRef?.name === "Mio 15×25", "a.10 hoopRef.id is its id");
  check(state().doc.nova?.hoopKind === "flat", "a.10 a flat user hoop writes hoopKind flat");
  check(state().past.length === past + 1, "a.10 one undo step");

  // a list read again after a restart has it
  check((await openUserHoops(disk)).list()[0]?.id === id, "the list comes back after a restart");

  // ---- a.11: the hoop is changed, then deleted from the list: the open design and the saved ones do not change
  const saved = path.join(dir, "Stemma.nsd");
  writeFileSync(saved, `${JSON.stringify(state().doc, null, 2)}\n`);
  const savedBytes = readFileSync(saved, "utf8");
  const open = state().doc;
  const openText = JSON.stringify(open);

  await hoops.update({ id, name: "Mio grande", width: 200, height: 300, shape: "oval", kind: "cap" });
  check(hoops.list()[0].name === "Mio grande" && hoops.list()[0].kind === "cap", "the hoop is changed in the list");
  check(state().doc === open && JSON.stringify(state().doc) === openText, "a.11 changing it leaves the open design as it was");

  const refused = await hoops.remove(id, () => false);
  check(!refused && hoops.list().length === 1, "deleting asks first: without a yes the hoop stays");
  const removed = await hoops.remove(id, () => true);
  check(removed && hoops.list().length === 0 && (await openUserHoops(disk)).list().length === 0, "a.11 the hoop is deleted from the list, also on disk");
  check(state().doc === open && JSON.stringify(state().doc) === openText, "a.11 the open design does not change");
  check(readFileSync(saved, "utf8") === savedBytes, "a.11 the saved design does not change");
  check(changes.length === 3, `every change of the list emits userHoops.changed (${changes.length})`);

  // selecting a hoop that is no longer in the list changes nothing
  const before = state().doc;
  runCommand("a.hoop.select", { source: "user", id });
  check(state().doc === before, "selecting a deleted hoop changes nothing");

  // ---- hoopKind: an explicit list of cap frames (contract, module a), never guessed from the name
  const presets = presetHoops();
  const kindOf = (id: string) => {
    runCommand("a.hoop.select", { source: "preset", id });
    return state().doc.nova?.hoopKind;
  };
  check(new Set(presets.map((p) => p.id)).size === presets.length, "every preset hoop has its own id");
  check(presets.length === HOOPS.length + MACHINES.reduce((n, m) => n + m.frames.length, 0), "the presets are Filum's hoops and every machine's frames");
  check(CAP_HOOPS.every((n) => HOOPS.some((h) => h.name === n)), `every hoop of lib/hoops.ts in the cap list exists (${CAP_HOOPS.join(", ")})`);
  check(CAP_FRAMES.every((id) => MACHINES.some((m) => m.frames.some((f) => f.id === id))), `every frame of machines.ts in the cap list exists (${CAP_FRAMES.join(", ")})`);

  // a.13: the generic «Cap 130 × 60 mm»
  check(kindOf("hoops:Cap 130 × 60 mm") === "cap", "a.13 the generic «Cap 130 × 60 mm» writes hoopKind cap");
  // a.14: Brother PR «Cap frame 13 × 6 cm», from lib/hoops.ts and from machines.ts
  check(kindOf("hoops:Brother PR Cap frame 13 × 6 cm") === "cap", "a.14 Brother PR «Cap frame 13 × 6 cm» from lib/hoops.ts writes cap");
  const prCaps = MACHINES.flatMap((m) => m.frames.filter((f) => f.id === "pr-cap").map((f) => `machine:${m.id}/${f.id}`));
  check(prCaps.length > 0 && prCaps.every((id) => kindOf(id) === "cap"), `a.14 …and from machines.ts, on every machine that has it (${prCaps.join(", ")})`);
  check(kindOf("hoops:Brother PR Wide cap frame 36 × 6 cm (10-needle)") === "cap", "the wide cap frame of lib/hoops.ts writes cap");
  const wide = MACHINES.flatMap((m) => m.frames.filter((f) => f.id === "pr-widecap").map((f) => `machine:${m.id}/${f.id}`));
  check(wide.length > 0 && wide.every((id) => kindOf(id) === "cap"), "pr-widecap of machines.ts writes cap");
  // a.15: the generic «130 × 180 mm»
  check(kindOf("hoops:130 × 180 mm") === "flat", "a.15 the generic «130 × 180 mm» writes hoopKind flat");
  // every other preset is flat, and hoopRef is null for presets
  const capIds = new Set(["hoops:Cap 130 × 60 mm", "hoops:Brother PR Cap frame 13 × 6 cm", "hoops:Brother PR Wide cap frame 36 × 6 cm (10-needle)", ...prCaps, ...wide]);
  const wrong = presets.filter((p) => kindOf(p.id) !== (capIds.has(p.id) ? "cap" : "flat") || state().doc.nova?.hoopRef !== null || !same(state().doc.hoop, p.hoop));
  check(wrong.length === 0, `every other preset writes flat, hoopRef null and its own doc.hoop (wrong: ${wrong.map((p) => p.id).join(", ") || "none"})`);

  const capId = await hoops.add({ name: "Cappello mio", width: 120, height: 50, shape: "rect", kind: "cap" });
  runCommand("a.hoop.select", { source: "user", id: capId });
  check(state().doc.nova?.hoopKind === "cap" && state().doc.nova?.hoopRef?.id === capId, "a user hoop of kind cap writes hoopKind cap");

  // ---- a.hoop.custom: doc.hoop, hoopRef null, flat
  runCommand("a.hoop.custom", { name: "Su misura", width: 123, height: 45, shape: "oval" });
  check(same(state().doc.hoop, { name: "Su misura", width: 123, height: 45, shape: "oval" }) && state().doc.nova?.hoopRef === null && state().doc.nova?.hoopKind === "flat", `a.hoop.custom writes doc.hoop, hoopRef null, flat (${JSON.stringify(state().doc.hoop)})`);
  const keep = state().doc;
  runCommand("a.hoop.custom", { name: "Rotto", width: -5, height: Number.NaN, shape: "rect" });
  check(state().doc === keep, "a custom hoop with impossible sizes changes nothing");

  // the commands keep the rest of nova (unknown fields too) and leave the objects alone
  const withFoo = { ...state().doc, nova: { ...state().doc.nova!, foo: 1, mode: "assisted" } } as StitchDocument;
  useStore.setState({ doc: withFoo });
  runCommand("a.hoop.select", { source: "user", id: capId });
  const n = state().doc.nova as unknown as Record<string, unknown>;
  check(n.foo === 1 && n.mode === "assisted" && state().doc.objects === withFoo.objects, "the commands change only doc.hoop, hoopRef and hoopKind");

  // a list with an impossible hoop is refused
  let bad = false;
  try {
    await hoops.add({ name: "", width: 0, height: 10, shape: "rect", kind: "flat" });
  } catch {
    bad = true;
  }
  check(bad && hoops.list().length === 1, "a hoop without a name or with a size of 0 is refused");

  // a damaged user-hoops.json: an empty list, the file is not overwritten until the next change
  writeFileSync(path.join(dir, USER_HOOPS_FILE), "{ broken");
  check((await openUserHoops(disk)).list().length === 0, "a damaged user-hoops.json gives an empty list");
  check(readFileSync(path.join(dir, USER_HOOPS_FILE), "utf8") === "{ broken", "…and is not overwritten by reading it");

  offEv();
  off();
  check(!getCommand("a.hoop.select"), "uninstalling removes the commands");
  done("module a, hoops");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
