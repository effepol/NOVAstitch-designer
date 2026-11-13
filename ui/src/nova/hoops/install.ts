// Module a, hoops in the app (through module 0's hooks): the user's list
// (user-hoops.json), the commands a.hoop.select / a.hoop.custom, Filum's hoop
// pickers running them (chooseHoop), the user's hoops in those pickers, and
// the panel that lists and edits them.

import { createElement } from "react";
import { runCommand } from "../core/commands";
import { on } from "../core/events";
import { hoopGroupsChanged, registerHoopChooser, registerHoopGroup } from "../core/hoopChoice";
import { tauriPrefsStore, type PrefsStore } from "../core/prefs";
import { registerPanel } from "../core/registry";
import { installHoops, presetHoops } from "./hoops";
import { HoopsPanel } from "./HoopsPanel";
import { openUserHoops, type UserHoops } from "./userHoops";
import "./texts";

export async function installHoopsApp(store: PrefsStore): Promise<{ hoops: UserHoops; uninstall: () => void }> {
  const hoops = await openUserHoops(store);
  const offs = [
    installHoops(hoops),
    registerHoopChooser({
      module: "a",
      choose(c) {
        if (c.source === "custom") {
          const { name, width, height, shape } = c.hoop;
          runCommand("a.hoop.custom", { name, width, height, shape: shape ?? "rect" });
        } else {
          // an id module a does not know is left to Filum
          if (c.source === "preset" ? !presetHoops().some((p) => p.id === c.id) : !hoops.get(c.id)) return false;
          runCommand("a.hoop.select", { source: c.source, id: c.id });
        }
        return true;
      },
    }),
    registerHoopGroup({ id: "a.userHoops", module: "a", label: "a.hoops.mine", list: () => hoops.list() }),
    on("userHoops.changed", () => hoopGroupsChanged()),
    registerPanel({ id: "a.hoops", module: "a", title: "a.hoops.title", order: 50, render: () => createElement(HoopsPanel, { hoops }) }),
  ];
  return { hoops, uninstall: () => offs.forEach((off) => off()) };
}

/** Started by module 0 (nova/core/modules.ts). */
export async function install(): Promise<void> {
  await installHoopsApp(tauriPrefsStore());
}
