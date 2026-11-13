// Module a, hoops in the app (through module 0's hooks): the user's list
// (user-hoops.json), the commands a.hoop.select / a.hoop.custom, Filum's hoop
// pickers running them (chooseHoop), the user's hoops in those pickers, and
// the panel that lists and edits them.

import { createElement } from "react";
import { getCommand, runCommand } from "../core/commands";
import { on } from "../core/events";
import { hoopGroupsChanged, registerHoopChooser, registerHoopGroup, type HoopChoice } from "../core/hoopChoice";
import { tauriPrefsStore, type PrefsStore } from "../core/prefs";
import { registerPanel } from "../core/registry";
import { installHoops, presetHoops } from "./hoops";
import { HoopsPanel } from "./HoopsPanel";
import { openUserHoops, type UserHoops } from "./userHoops";
import "./texts";

/** The command a hoop choice runs; null: an id module a does not know (left to Filum). */
function asCommand(c: HoopChoice, hoops: UserHoops): { id: string; params: unknown } | null {
  if (c.source === "custom") {
    const { name, width, height, shape } = c.hoop;
    return { id: "a.hoop.custom", params: { name, width, height, shape: shape ?? "rect" } };
  }
  if (c.source === "preset" ? !presetHoops().some((p) => p.id === c.id) : !hoops.get(c.id)) return null;
  return { id: "a.hoop.select", params: { source: c.source, id: c.id } };
}

export async function installHoopsApp(store: PrefsStore): Promise<{ hoops: UserHoops; uninstall: () => void }> {
  const hoops = await openUserHoops(store);
  const offs = [
    installHoops(hoops),
    registerHoopChooser({
      module: "a",
      // Filum's pickers: the choice as one command (one undo step)
      choose(c) {
        const cmd = asCommand(c, hoops);
        if (!cmd) return false;
        runCommand(cmd.id, cmd.params);
        return true;
      },
      // a design not open yet (a new design): the same command's pure apply, no undo step
      apply(doc, c) {
        const cmd = asCommand(c, hoops);
        return cmd ? getCommand(cmd.id)!.apply(doc, cmd.params) : null;
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
