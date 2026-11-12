// Test P (approved 12/11): app settings, not undoable, kept across restarts.

import { check, done } from "./testkit";
import { mkdtempSync, readdirSync, readFileSync, existsSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useStore } from "../../store";
import { openPrefs, type PrefsStore } from "./prefs";

// the app config folder, on disk (in the app: Tauri appConfigDir)
const dir = mkdtempSync(path.join(tmpdir(), "nova-prefs-"));
const disk: PrefsStore = {
  read: async (name) => (existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), "utf8") : null),
  write: async (name, text) => writeFileSync(path.join(dir, name), text),
  rename: async (from, to) => renameSync(path.join(dir, from), path.join(dir, to)),
  remove: async (name) => rmSync(path.join(dir, name), { force: true }),
};

(async () => {
  const docBefore = useStore.getState().doc;
  const pastBefore = useStore.getState().past.length;

  const prefs = await openPrefs(disk);
  await prefs.set("grid.step", 2);
  check(prefs.get("grid.step") === 2, "P prefs.get gives the value just set");
  const files = readdirSync(dir);
  check(files.length === 1 && files[0].endsWith(".json"), `P one JSON file in the config folder, no temporary file left (${files.join(", ")})`);
  const saved = JSON.parse(readFileSync(path.join(dir, files[0]), "utf8"));
  check(saved.schemaVersion === 1 && saved.values["grid.step"] === 2, `P the file holds the value, with its schemaVersion (${JSON.stringify(saved)})`);

  // the temporary file is renamed over the old one: a failed write keeps the old file
  const broken: PrefsStore = { ...disk, rename: async () => { throw new Error("disk full"); } };
  const p2 = await openPrefs(broken);
  let threw = false;
  try { await p2.set("grid.step", 5); } catch { threw = true; }
  check(threw && JSON.parse(readFileSync(path.join(dir, files[0]), "utf8")).values["grid.step"] === 2, "P a failed write leaves the old file as it was");
  check(readdirSync(dir).length === 1, "P …and no temporary file");
  check(p2.get("grid.step") === 2, "P …and the value in memory is the old one");

  // restart: a new instance reads it back
  const again = await openPrefs(disk);
  check(again.get("grid.step") === 2, "P after a restart prefs.get gives 2");

  check(useStore.getState().doc === docBefore && useStore.getState().past.length === pastBefore, "P the document and the undo history do not change");

  // remove asks first
  const refused = await again.remove("grid.step", async () => false);
  check(!refused && again.get("grid.step") === 2, "P remove without confirmation keeps the value");
  const removed = await again.remove("grid.step", async () => true);
  check(removed && again.get("grid.step") === undefined && (await openPrefs(disk)).get("grid.step") === undefined, "P remove with confirmation deletes it, also on disk");

  done("prefs");
})().catch((e) => { console.error(e); process.exit(1); });
