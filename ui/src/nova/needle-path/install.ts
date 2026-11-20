// Module d (Views: needle path) starts here: module 0 finds this file and calls install() once.
// Everything goes through module 0's registry: the line that takes the place of
// Filum's stitch line in the stitch view, a bar button and the View menu items.

import { isTauri } from "../../lib/platform";
import { openPrefs, prefs, type PrefsStore } from "../core/prefs";
import { registerMenuItem, registerStitchLine, registerToolbarButton } from "../core/registry";
import { drawNeedlePath } from "./draw";
import { loadNeedlePathSettings, needlePathSettings, onNeedlePathSettings, setNeedlePathSetting } from "./state";
import "./texts";

/** The line widths offered in the menu (px); any other comes from the settings file. */
export const WIDTHS = [1, 2, 3] as const;

/** Registers the line, the button and the menu items; returns the function that removes them. */
export function installNeedlePath(): () => void {
  const s = needlePathSettings;
  const offLine = registerStitchLine({
    id: "d.needlePath",
    module: "d",
    active: () => s().enabled,
    draw: (ctx, info, plan, limit) => void drawNeedlePath(ctx, plan, info, s(), { showUnderlay: info.showUnderlay, limit }),
  });
  // the button is registered again when the option changes: the bar re-reads the registry and shows it on or off
  let offButton = () => {};
  const addButton = () => {
    offButton();
    offButton = registerToolbarButton({
      id: "d.needlePath",
      module: "d",
      label: "d.bar.needlePath",
      title: "d.bar.needlePath.title",
      order: 20,
      anchor: "d.needlePath",
      run: () => void setNeedlePathSetting("enabled", !s().enabled),
      active: () => s().enabled,
    });
  };
  addButton();
  const offSettings = onNeedlePathSettings(addButton);
  const off = () => !s().enabled;
  const menu = [
    registerMenuItem({ id: "d.needlePath", module: "d", menu: "View", label: "d.menu.needlePath", anchor: "d.menu.needlePath", order: 20, run: () => void setNeedlePathSetting("enabled", !s().enabled), checked: () => s().enabled }),
    registerMenuItem({ id: "d.needlePath.dots", module: "d", menu: "View", label: "d.menu.dots", anchor: "d.menu.dots", order: 21, run: () => void setNeedlePathSetting("dots", !s().dots), checked: () => s().dots, disabled: off }),
    ...WIDTHS.map((w, i) =>
      registerMenuItem({ id: `d.needlePath.width${w}`, module: "d", menu: "View", label: `d.menu.width${w}`, anchor: `d.menu.width${w}`, order: 22 + i, run: () => void setNeedlePathSetting("widthPx", w), checked: () => s().widthPx === w, disabled: off }),
    ),
  ];
  return () => {
    offLine();
    offSettings();
    offButton();
    menu.forEach((m) => m());
  };
}

export function install(): void {
  installNeedlePath();
  // the settings saved last time: the app's settings on the desktop, the browser's storage on the web
  (isTauri ? prefs() : openPrefs(browserStore()))
    .then(loadNeedlePathSettings)
    .catch((e) => console.warn("nova: the needle path starts off (settings not readable)", e));
}

/** The settings file kept in the browser's storage (the web build has no config folder). */
function browserStore(): PrefsStore {
  const key = (name: string) => `nova.${name}`;
  return {
    read: async (name) => localStorage.getItem(key(name)),
    write: async (name, text) => localStorage.setItem(key(name), text),
    rename: async (from, to) => {
      const v = localStorage.getItem(key(from));
      if (v !== null) localStorage.setItem(key(to), v);
      localStorage.removeItem(key(from));
    },
    remove: async (name) => localStorage.removeItem(key(name)),
  };
}
