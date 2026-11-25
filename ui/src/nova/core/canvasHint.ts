// The canvas label (module 0, Signor Poletti 25/11): the hint or value Filum
// draws next to the cursor (Canvas.tsx penHint, iRef.current.tooltip, the
// satin's width) covered the aiming point under module c's cross. It is drawn
// at the bottom of the canvas, centred (at the top when the cursor is there),
// for 10 s after a tool is chosen, and again at every choice of a tool, the
// same one too. A drag's values (Δ mm, angle) stay while dragging.

/** How long the label stays after a tool is chosen (ms). */
export const HINT_MS = 10_000;

// the program's start counts as a choice: the first tool's hints show too
let pickedAt = Date.now();
const listeners = new Set<() => void>();

/** A tool was chosen (store.setTool calls this, for the same tool too). */
export function markToolPicked(now = Date.now()): void {
  pickedAt = now;
  for (const fn of [...listeners]) fn();
}

/** Called at every choice of a tool; returns the function that stops it. */
export function onToolPicked(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is the label shown now? While dragging, always (the drag's values). */
export const hintVisible = (now: number, dragging: boolean): boolean => dragging || now - pickedAt < HINT_MS;

/** Where the label goes (CSS px of the canvas; x: its left edge, y: its text's baseline). */
export function hintPosition(width: number, height: number, textWidth: number, cursor: [number, number] | null): { x: number; y: number } {
  const x = Math.max(8, (width - textWidth) / 2);
  const bottom = height - 22;
  // the cursor on the label's place: at the top instead, away from it
  const onIt = !!cursor && cursor[1] > bottom - 40 && Math.abs(cursor[0] - width / 2) < textWidth / 2 + 40;
  return { x, y: onIt ? 34 : bottom };
}
