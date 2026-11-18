// Module d's settings: in the app's settings file (never in the document), with defaults.

import { check, done } from "../core/testkit";
import { openPrefs, PREFS_FILE, type PrefsStore } from "../core/prefs";
import { onCanvasRedraw } from "../core/registry";
import { loadNeedlePathSettings, needlePathSettings, setNeedlePathSetting } from "./state";

const files = new Map<string, string>();
const store: PrefsStore = {
  read: async (n) => files.get(n) ?? null,
  write: async (n, t) => void files.set(n, t),
  rename: async (a, b) => {
    files.set(b, files.get(a)!);
    files.delete(a);
  },
};

(async () => {
  const p = await openPrefs(store);
  const s = loadNeedlePathSettings(p);
  check(!s.enabled && s.widthPx === 1 && !s.dots, "settings: needle path off, 1 px, no dots by default");
  let redraws = 0;
  const off = onCanvasRedraw(() => redraws++);
  await setNeedlePathSetting(p, "enabled", true);
  await setNeedlePathSetting(p, "dots", true);
  await setNeedlePathSetting(p, "widthPx", 2);
  off();
  const saved = JSON.parse(files.get(PREFS_FILE)!).values;
  check(saved["needlePath.enabled"] === true && saved["needlePath.dots"] === true && saved["needlePath.widthPx"] === 2, "settings: saved as needlePath.enabled, needlePath.dots, needlePath.widthPx");
  check(needlePathSettings().enabled && needlePathSettings().dots && needlePathSettings().widthPx === 2, "settings: in force at once");
  check(redraws === 3, `settings: the canvas is redrawn on each change (${redraws})`);
  // read again from the file, as at the next start
  const again = loadNeedlePathSettings(await openPrefs(store));
  check(again.enabled && again.dots && again.widthPx === 2, "settings: kept at the next start");
  // a wrong value gets its default or its limit
  check(loadNeedlePathSettings({ get: (k) => ({ "needlePath.widthPx": "x", "needlePath.enabled": 1 })[k] }).widthPx === 1, "settings: a width that is not a number is 1 px");
  check(loadNeedlePathSettings({ get: (k) => (k === "needlePath.widthPx" ? 99 : undefined) }).widthPx === 8, "settings: the width is at most 8 px");
  done("needle path settings");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
