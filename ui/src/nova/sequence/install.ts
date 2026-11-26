// Module b (Sequence list) starts here: module 0 finds this file and calls install() once.

import { createElement } from "react";
import { registerPanel } from "../core/registry";
import { isTauri } from "../../lib/platform";
import { openPrefs, prefs, type PrefsStore } from "../core/prefs";
import { registerSequenceCommands } from "./commands";
import { SequencePanel } from "./SequencePanel";
import { registerCanvasViews } from "./canvas";
import { loadViewOptions } from "./view";
import "./texts";
import { ListOrdered } from "lucide-react";

export function install(): void {
  registerSequenceCommands();
  registerPanel({ id: "b.sequence", module: "b", title: "b.title", icon: ListOrdered, render: () => createElement(SequencePanel) });
  registerCanvasViews();
  // the view options saved last time: the app's settings on the desktop, the browser's storage on the web
  (isTauri ? prefs() : openPrefs(browserStore()))
    .then(loadViewOptions)
    .catch((e) => console.warn("nova: the Sequence view options start off (settings not readable)", e));
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
