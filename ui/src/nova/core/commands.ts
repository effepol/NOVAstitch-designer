// Commands (contract, section 3, common rules): an undoable action of a module.
// A command is a pure function of the document; it runs only through
// runCommand, which calls store.commit once: one command = one undo step.

import { useStore } from "../../store";
import type { StitchDocument } from "../../types";
import { emit } from "./events";
import { withRunning } from "./running";

export interface Command<P = unknown> {
  /** "<module>.<name>", e.g. "b.reorder". */
  id: string;
  label: { it: string; en: string };
  /** Applied by the program (fabric preset, Assisted rules): not a manual edit. */
  system?: boolean;
  /** Pure: no effect outside the document it returns. */
  apply(doc: StitchDocument, params: P): StitchDocument;
}

const commands = new Map<string, Command<never>>();

/** The command whose commit is running, if any (read by the manual-edit record and the bus). */
export { runningCommand } from "./running";

/** Register a command; returns a function that removes it. */
export function registerCommand<P>(cmd: Command<P>): () => void {
  if (!/^[a-z0-9]+\.[A-Za-z0-9_.-]+$/.test(cmd.id)) throw new Error(`Command id "${cmd.id}" is not "<module>.<name>"`);
  if (commands.has(cmd.id)) throw new Error(`Command "${cmd.id}" is already registered`);
  commands.set(cmd.id, cmd as unknown as Command<never>);
  return () => {
    if (commands.get(cmd.id) === (cmd as unknown)) commands.delete(cmd.id);
  };
}

export const getCommand = (id: string): Command<unknown> | undefined => commands.get(id) as Command<unknown> | undefined;

/** Run a registered command as one undo step. A command that changes nothing leaves no step. */
export function runCommand<P>(id: string, params: P): void {
  const cmd = commands.get(id) as Command<P> | undefined;
  if (!cmd) throw new Error(`Unknown command "${id}"`);
  const store = useStore.getState();
  const next = cmd.apply(store.doc, params);
  if (next !== store.doc) withRunning({ id: cmd.id, system: !!cmd.system }, () => store.commit(() => next));
  emit("command.executed", { id, params });
}
