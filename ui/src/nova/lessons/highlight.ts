// Module g: what the current step points at. An anchor (data-nova-anchor of
// any module) gets an outline in the accent colour, through one style rule the
// module owns, so it follows the element wherever the layout puts it; an
// object of the design gets a dashed frame on a canvas layer over the design.

import type { StitchDocument } from "../../types";
import { objectBounds } from "../../lib/geometry";
import type { LayerInfo } from "../core/registry";
import type { Step } from "./lesson";

const STYLE_ID = "nova-lesson-highlight";
const ATTR = "data-nova-anchor";

/** The CSS that outlines one anchor (anchors are checked by the validator: letters, digits, . _ -). */
export function anchorRule(anchor: string): string {
  const sel = `[${ATTR}="${anchor.replace(/["\\]/g, "")}"]`;
  return `${sel} { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-sm, 4px); }`;
}

/** Put the rule for the step's anchor in the page (or take it away); the element is scrolled into view. */
export function showAnchor(h: Step["highlight"] | null, doc: Document | undefined = globalThis.document): void {
  if (!doc) return;
  let style = doc.getElementById(STYLE_ID);
  const anchor = typeof h === "string" ? h : null;
  if (!anchor) {
    style?.remove();
    return;
  }
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  const rule = anchorRule(anchor);
  if (style.textContent === rule) return;
  style.textContent = rule;
  const el = doc.querySelector(`[${ATTR}="${anchor}"]`);
  (el as HTMLElement | null)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

/** The frame around the step's object, in mm (a canvas layer over the design). */
export function drawObjectHighlight(ctx: CanvasRenderingContext2D, info: LayerInfo, doc: StitchDocument, h: Step["highlight"] | null, colour: string): void {
  if (!h || typeof h === "string") return;
  const o = doc.objects.find((x) => x.id === h.object);
  const b = o ? objectBounds(o) : null;
  if (!b) return;
  const px = 1 / info.scale;
  const pad = 6 * px;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);
}
