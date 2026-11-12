// Module a, hoops in the app (through module 0's hooks): Filum's hoop pickers
// run a.hoop.select / a.hoop.custom, the user's hoops appear in them, and a
// panel lists them. a.13–a.15 from Filum's own pickers.

import { check, done } from "../core/testkit";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useStore } from "../../store";
import { chooseHoop, hoopGroups } from "../core/hoopChoice";
import { panels } from "../core/registry";
import type { PrefsStore } from "../core/prefs";
import { installHoopsApp } from "./install";

const dir = mkdtempSync(path.join(tmpdir(), "nova-hoops-app-"));
const disk: PrefsStore = {
  read: async (n) => (existsSync(path.join(dir, n)) ? readFileSync(path.join(dir, n), "utf8") : null),
  write: async (n, t) => writeFileSync(path.join(dir, n), t),
  rename: async (a, b) => renameSync(path.join(dir, a), path.join(dir, b)),
  remove: async (n) => rmSync(path.join(dir, n), { force: true }),
};
const state = () => useStore.getState();
const filum = () => {
  throw new Error("Filum's own change must not run");
};

(async () => {
  const { hoops, uninstall } = await installHoopsApp(disk);

  // a.13–a.15 from Filum's pickers (lib/hoops.ts ids, machines.ts ids)
  chooseHoop({ source: "preset", id: "hoops:Cap 130 × 60 mm" }, filum);
  check(state().doc.nova?.hoopKind === "cap" && state().doc.hoop.width === 130, "a.13 Filum's picker, «Cap 130 × 60 mm»: hoopKind cap");
  chooseHoop({ source: "preset", id: "machine:brother-pr6/pr-cap" }, filum);
  const fromMachine = state().doc.nova?.hoopKind;
  chooseHoop({ source: "preset", id: "hoops:Brother PR Cap frame 13 × 6 cm" }, filum);
  check(state().doc.nova?.hoopKind === "cap", "a.14 Filum's picker, Brother PR «Cap frame 13 × 6 cm»: hoopKind cap");
  chooseHoop({ source: "preset", id: "hoops:130 × 180 mm" }, filum);
  check(state().doc.nova?.hoopKind === "flat" && state().doc.nova?.hoopRef === null, "a.15 Filum's picker, «130 × 180 mm»: hoopKind flat");
  check(fromMachine === "cap", "a.14 a machine's cap frame (machine settings, export dialog) writes cap");

  // custom sizes (W, H, shape in Filum's panel): a.hoop.custom
  const past = state().past.length;
  chooseHoop({ source: "custom", hoop: { name: "Custom", width: 111, height: 99, shape: "oval" } }, filum);
  check(state().doc.hoop.width === 111 && state().doc.hoop.shape === "oval" && state().doc.nova?.hoopRef === null && state().past.length === past + 1, "custom sizes go through a.hoop.custom, one undo step");

  // an unknown preset id: declined, Filum's own change runs
  let ran = false;
  chooseHoop({ source: "preset", id: "hoops:nothing" }, () => (ran = true));
  check(ran, "an unknown preset is left to Filum");

  // the user's hoops in the pickers, and picked from there
  const id = await hoops.add({ name: "Mio 15×25", width: 150, height: 250, shape: "rect", kind: "flat" });
  const group = hoopGroups().find((g) => g.module === "a");
  check(!!group && group.list().some((h) => h.id === id && h.name === "Mio 15×25"), "the user's hoops appear in Filum's pickers");
  chooseHoop({ source: "user", id }, filum);
  check(JSON.stringify(state().doc.hoop) === JSON.stringify({ name: "Mio 15×25", width: 150, height: 250 }) && state().doc.nova?.hoopRef?.id === id, "a.10 from Filum's picker");
  await hoops.remove(id, () => true);
  check(!group!.list().some((h) => h.id === id), "a deleted hoop leaves the pickers");

  // the panel that lists and edits them
  check(panels().some((p) => p.module === "a" && p.id === "a.hoops"), "module a adds the hoops panel");
  const anchors = JSON.parse(readFileSync(path.resolve(process.cwd(), "src", "nova", "hoops", "anchors.json"), "utf8"));
  const panelSrc = readFileSync(path.resolve(process.cwd(), "src", "nova", "hoops", "HoopsPanel.tsx"), "utf8");
  const used = [...panelSrc.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]);
  check(used.length > 0 && used.every((a) => a in anchors) && Object.keys(anchors).every((a) => used.includes(a)), `every lesson anchor of the panel is in anchors.json (${used.join(", ")})`);

  uninstall();
  check(!hoopGroups().some((g) => g.module === "a") && !panels().some((p) => p.id === "a.hoops"), "uninstalling removes the group and the panel");
  done("module a, hoops in the app");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
