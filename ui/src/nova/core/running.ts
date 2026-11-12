// The command whose commit is running, if any. Kept apart from commands.ts so
// the store can read it without importing the store back.

let running: { id: string; system: boolean } | null = null;

export const runningCommand = (): { id: string; system: boolean } | null => running;

export function withRunning<T>(cmd: { id: string; system: boolean }, fn: () => T): T {
  const outer = running;
  running = cmd;
  try {
    return fn();
  } finally {
    running = outer;
  }
}
