// Module c, the cross across the whole window (cursor.mode = crossWindow): two
// thin lines, fixed over the app, through the pointer. They let the pointer's
// events through and are removed when the mode changes or the module goes.

import { CROSS_COLORS, type CrossArms } from "./cross";
import type { Vec2 } from "../../types";

let lines: { v: HTMLDivElement; h: HTMLDivElement } | null = null;

const make = (): { v: HTMLDivElement; h: HTMLDivElement } => {
  const line = (vertical: boolean) => {
    const d = document.createElement("div");
    d.dataset.nova = "c";
    d.setAttribute("aria-hidden", "true");
    Object.assign(d.style, { position: "fixed", pointerEvents: "none", zIndex: "2147483000", left: "0", top: "0" });
    Object.assign(d.style, vertical ? { width: "0", height: "100vh" } : { width: "100vw", height: "0" });
    document.body.appendChild(d);
    return d;
  };
  return { v: line(true), h: line(false) };
};

/** Shows the window cross at `client` (CSS px), or hides it with null. */
export function showWindowCross(client: Vec2 | null, arms: CrossArms = { vertical: false, horizontal: false }): void {
  if (typeof document === "undefined") return;
  if (!client) {
    lines?.v.remove();
    lines?.h.remove();
    lines = null;
    return;
  }
  lines ??= make();
  const border = (aligned: boolean) => `${aligned ? 2 : 1}px solid ${aligned ? CROSS_COLORS.aligned : CROSS_COLORS.normal}`;
  lines.v.style.transform = `translateX(${client[0]}px)`;
  lines.v.style.borderLeft = border(arms.vertical);
  lines.h.style.transform = `translateY(${client[1]}px)`;
  lines.h.style.borderTop = border(arms.horizontal);
}
