// File › «Print PDF» and Ctrl+P (module 0, for module l): the registered
// command l.sheet.export (the module's sheet) when there is one, else Filum's
// own (the "production" dialog).

import { getCommand, runCommand } from "./commands";

export const SHEET_COMMAND = "l.sheet.export";

export function printSheet(fallback: () => void): void {
  if (getCommand(SHEET_COMMAND)) runCommand(SHEET_COMMAND, {});
  else fallback();
}
