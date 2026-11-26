// Module f (Patch and library) starts here: module 0 finds this file and calls install() once.

import { createElement } from "react";
import { registerMenuItem, registerPanel } from "../core/registry";
import { useStore } from "../../store";
import { registerPatchCommands } from "./commands";
import { watchOverflow } from "./events";
import { createFromSelection, PatchPanel } from "./PatchPanel";
import { installLibrary } from "./installLibrary";
import "./texts";
import { Shield } from "lucide-react";

/** Commands, the outside-the-hoop check, the panel and the menu item; returns the function that removes them. */
export function installPatch(): () => void {
  const offs = [
    registerPatchCommands(),
    watchOverflow(),
    registerPanel({ id: "f.patch", module: "f", title: "f.patch.title", order: 60, icon: Shield, render: () => createElement(PatchPanel) }),
    registerMenuItem({
      id: "f.patch.create",
      module: "f",
      menu: "Object",
      label: "f.patch.menu",
      run: createFromSelection,
      disabled: () => !useStore.getState().selection.length,
    }),
  ];
  return () => offs.forEach((off) => off());
}

export function install(): void {
  installPatch();
  installLibrary();
}
