// Module b (Sequence list) starts here: module 0 finds this file and calls install() once.

import { createElement } from "react";
import { registerPanel } from "../core/registry";
import { registerSequenceCommands } from "./commands";
import { SequencePanel } from "./SequencePanel";
import "./texts";

export function install(): void {
  registerSequenceCommands();
  registerPanel({ id: "b.sequence", module: "b", title: "b.title", render: () => createElement(SequencePanel) });
}
