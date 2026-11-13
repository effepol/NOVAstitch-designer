// Module b (Sequence list) starts here: module 0 finds this file and calls install() once.

import { registerSequenceCommands } from "./commands";

export function install(): void {
  registerSequenceCommands();
}
