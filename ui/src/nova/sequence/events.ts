// Module b's event (contract, «b — Lista sequenza»): a row of the list got the focus.

import { emit } from "../core/events";

declare module "../core/events" {
  interface NovaEvents {
    "sequence.rowFocused": { id: string };
  }
}

/** A row was clicked or reached with the keyboard: its first object's id. */
export const focusRow = (id: string) => emit("sequence.rowFocused", { id });
