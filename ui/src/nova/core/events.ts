// The event bus nova/core/events (contract, section 3): notifications only.
// No module changes the document in answer to an event except through a command.

import type { PlanStats, ViewMode } from "../../types";

/** The common events (emitted by module 0) and their payloads. */
export interface CoreEvents {
  "doc.loaded": { path: string | null; fromSchema: number; migrated: boolean; readOnly: boolean; warnings: string[] };
  "doc.saved": { path: string };
  /** commandId null: a change made by Filum itself (panels, tools, undo). */
  "doc.changed": { commandId: string | null };
  "command.executed": { id: string; params: unknown };
  "selection.changed": { ids: string[] };
  "plan.ready": { stats: PlanStats };
  "view.changed": { mode: ViewMode; scale: number; ox: number; oy: number; zoomFactor: number };
}

/** Modules add their own events here by declaration merging (e.g. "sequence.rowFocused"). */
export interface NovaEvents extends CoreEvents {}

type Payload<K extends string> = K extends keyof NovaEvents ? NovaEvents[K] : unknown;
type Listener = (payload: never) => void;

const listeners = new Map<string, Listener[]>();

/** Listen to an event; returns the function that stops listening. */
export function on<K extends keyof NovaEvents | (string & {})>(type: K, fn: (payload: Payload<K>) => void): () => void {
  const list = listeners.get(type) ?? [];
  listeners.set(type, [...list, fn as Listener]);
  return () => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
}

/** Send an event to every listener subscribed before the sending started. A listener that fails is reported and skipped. */
export function emit<K extends keyof NovaEvents | (string & {})>(type: K, payload: Payload<K>): void {
  // the list as it is now: a listener added meanwhile waits for the next event
  for (const fn of listeners.get(type) ?? []) {
    try {
      (fn as (p: Payload<K>) => void)(payload);
    } catch (e) {
      console.error(`nova: a listener of "${type}" failed`, e);
    }
  }
}
