// Module b, part 2: what the canvas layers draw, computed from the document and
// its plan (no state of their own).
//   «Start and end»: Filum's S and E pins (canvas/interactive.ts draws them on the
//   selected object only) on every object, with its place in the sewing order.
//   «Connections»: a line from the end of each object to the start of the next —
//   red = trim, blue = jump, green = sewn through; faint when the program chose it,
//   full when it was set by hand. One red line for every trim of the plan
//   (PlanStats.trims counts them), the last one included.

import { FLAG, type DesignObject, type PlanData, type StitchDocument, type Vec2 } from "../../types";
import { stitchEnds } from "../../canvas/handles";

export interface Mark {
  objId: string;
  /** Place in the sewing order, from 1. */
  n: number;
  kind: "start" | "end";
  p: Vec2;
  /** Not set by hand: where the engine starts / ends now. */
  auto: boolean;
}

/** S and E of every object that sews, in sewing order. */
export function startEndMarks(doc: StitchDocument, plan: Pick<PlanData, "coords" | "flags" | "objects"> | null): Mark[] {
  const out: Mark[] = [];
  doc.objects.forEach((o, i) => {
    if (!o.visible || o.stitch.type === "none" || o.stitch.type === "manual") return;
    const ends = plan ? stitchEnds(plan as PlanData, i) : null;
    const s = o.start ?? ends?.[0];
    const e = o.end ?? ends?.[1];
    if (s) out.push({ objId: o.id, n: i + 1, kind: "start", p: s, auto: !o.start });
    if (e) out.push({ objId: o.id, n: i + 1, kind: "end", p: e, auto: !o.end });
  });
  return out;
}

export type LinkKind = "trim" | "jump" | "join";

export interface Connection {
  kind: LinkKind;
  /** The last stitch before it and the first after it (none after the design's last trim). */
  from: Vec2;
  to: Vec2 | null;
  /** The object that ends there (undefined for the engine's own stitching, e.g. basting). */
  objId?: string;
  /** Chosen by hand (trim after, or the object's link); else the program's choice. */
  manual: boolean;
}

/** The object's link to the next one (module 0's field; absent = Filum decides). */
export const linkOf = (o: DesignObject | undefined): "join" | "jump" | undefined => o?.link;

/**
 * The connections of a plan. Every trim from the plan's records (so the red lines
 * are as many as PlanStats.trims); a jump or sewn connection between two objects
 * from the plan's links (module 0), or, in a plan without them, from its records.
 */
export function connections(doc: StitchDocument, plan: Pick<PlanData, "coords" | "flags" | "objects" | "links">): Connection[] {
  const out: Connection[] = [];
  const { coords, flags, objects } = plan;
  const links = plan.links;
  let prev = -1;
  let trims = 0;
  let jumped = false;
  const at = (i: number): Vec2 => [coords[2 * i], coords[2 * i + 1]];
  const ended = (i: number) => doc.objects[objects[i]];
  const push = (kind: LinkKind, to: Vec2 | null) => {
    const o = ended(prev);
    const manual = kind === "trim" ? !!o?.trimAfter : !!linkOf(o);
    out.push({ kind, from: at(prev), to, objId: o?.id, manual });
  };
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f & FLAG.COMMANDS) {
      if (f & FLAG.TRIM) trims++;
      if (f & FLAG.JUMP) jumped = true;
      continue;
    }
    if (prev >= 0) {
      for (let k = 0; k < trims; k++) push("trim", at(i));
      if (!trims && !links && objects[i] !== objects[prev]) push(jumped ? "jump" : "join", at(i));
    }
    trims = 0;
    jumped = false;
    prev = i;
  }
  if (prev >= 0) for (let k = 0; k < trims; k++) push("trim", null);
  // the engine's own account of each connection between two objects: jumps and sewn ones
  for (const l of links ?? []) {
    if (l.kind !== "jump" && l.kind !== "sew") continue;
    out.push({ kind: l.kind === "sew" ? "join" : "jump", from: l.start, to: l.end, objId: doc.objects[l.from]?.id, manual: l.manual });
  }
  return out;
}

export const LINK_COLOR: Record<LinkKind, string> = { trim: "#d64545", jump: "#2f6fdf", join: "#1f9d55" };

/** Draws the connections (the context is in mm; `scale` = px per mm). */
export function drawConnections(ctx: CanvasRenderingContext2D, list: Connection[], scale: number): void {
  for (const c of list) {
    ctx.save();
    ctx.strokeStyle = LINK_COLOR[c.kind];
    ctx.globalAlpha = c.manual ? 1 : 0.45;
    ctx.lineWidth = (c.manual ? 2.5 : 1.5) / scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (c.to) {
      ctx.moveTo(c.from[0], c.from[1]);
      ctx.lineTo(c.to[0], c.to[1]);
    } else {
      // the last trim of the design: a small cross where it cuts
      const k = 4 / scale;
      ctx.moveTo(c.from[0] - k, c.from[1] - k);
      ctx.lineTo(c.from[0] + k, c.from[1] + k);
      ctx.moveTo(c.from[0] - k, c.from[1] + k);
      ctx.lineTo(c.from[0] + k, c.from[1] - k);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Filum's start / end pin (the same shape as canvas/interactive.ts), with the sewing order beside it. */
export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[], scale: number): void {
  for (const m of marks) {
    const p = m.p;
    const r = 8 / scale;
    ctx.save();
    ctx.globalAlpha = m.auto ? 0.75 : 1;
    ctx.fillStyle = m.kind === "start" ? "#1f9d55" : "#d64545";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5 / scale;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.bezierCurveTo(p[0] - r * 1.1, p[1] - r * 0.9, p[0] - r * 0.9, p[1] - r * 2.4, p[0], p[1] - r * 2.4);
    ctx.bezierCurveTo(p[0] + r * 0.9, p[1] - r * 2.4, p[0] + r * 1.1, p[1] - r * 0.9, p[0], p[1]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${10 / scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.kind === "start" ? "S" : "E", p[0], p[1] - r * 1.55);
    // the place in the sewing order, beside the pin, outlined so it reads on any thread
    ctx.font = `700 ${10 / scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.lineWidth = 3 / scale;
    ctx.strokeText(String(m.n), p[0] + r * 1.15, p[1] - r * 1.55);
    ctx.fillStyle = m.kind === "start" ? "#1f9d55" : "#d64545";
    ctx.fillText(String(m.n), p[0] + r * 1.15, p[1] - r * 1.55);
    ctx.restore();
  }
}

/** How near the pointer must be to a connection line, in screen pixels. */
export const HIT_PX = 6;

/**
 * The connection the user clicked (contract «b, parte 2», Architect's conditions of 19/11):
 * only with «Connections» on, only with the selection tool and the left button, only within
 * HIT_PX of a line, and only a connection between two objects (the one after an object) —
 * otherwise null, and the click stays Filum's selection. The nearest line wins.
 */
export function connectionAt(
  list: Connection[],
  p: Vec2,
  o: { scale: number; linksOn: boolean; tool: string; button: number },
): Connection | null {
  if (!o.linksOn || o.tool !== "select" || o.button !== 0) return null;
  const tol = HIT_PX / o.scale;
  let best: Connection | null = null;
  let bestD = tol;
  for (const c of list) {
    if (!c.to || !c.objId) continue;
    const d = segmentDistance(p, c.from, c.to);
    if (d <= bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Lock stitch icons in the Sequence panel (Signor Poletti, 25/11): on = green, off = red. */
export const TIE_COLOR = { on: "#1f9d55", off: "#d64545" } as const;

/**
 * What the plan does after each object (by object id), from module 0's plan.links:
 * a trim (or a colour change, where the machine cuts), a jump, or sewn through.
 * The row's connection icon takes the colour of its line.
 */
export function linkKinds(doc: StitchDocument, plan: Pick<PlanData, "links"> | null | undefined): Map<string, LinkKind> {
  const out = new Map<string, LinkKind>();
  for (const l of plan?.links ?? []) {
    const id = doc.objects[l.from]?.id;
    if (id) out.set(id, l.kind === "sew" ? "join" : l.kind === "jump" ? "jump" : "trim");
  }
  return out;
}

export interface Neighbor {
  objId: string;
  /** Place in the sewing order, from 1. */
  n: number;
  p: Vec2;
}

/**
 * The selected object's neighbours in sewing order (Signor Poletti, 25/11): the last
 * stitch of the object sewn before it and the first stitch of the one sewn after it,
 * where they exist. The selection is one object or one run of objects in a row (a
 * lettering); objects that sew nothing are skipped. Anything else: none.
 */
export function neighborPoints(
  doc: StitchDocument,
  plan: Pick<PlanData, "coords" | "flags" | "objects"> | null,
  selection: string[],
): { prev: Neighbor | null; next: Neighbor | null } {
  const none = { prev: null, next: null };
  if (!plan || !selection.length) return none;
  const sel = new Set(selection);
  const idx = doc.objects.map((o, i) => (sel.has(o.id) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length || idx[idx.length - 1] - idx[0] !== idx.length - 1) return none;
  const ends = (i: number) => stitchEnds(plan as PlanData, i);
  let prev: Neighbor | null = null;
  for (let i = idx[0] - 1; i >= 0 && !prev; i--) {
    const e = ends(i);
    if (e) prev = { objId: doc.objects[i].id, n: i + 1, p: e[1] };
  }
  let next: Neighbor | null = null;
  for (let i = idx[idx.length - 1] + 1; i < doc.objects.length && !next; i++) {
    const e = ends(i);
    if (e) next = { objId: doc.objects[i].id, n: i + 1, p: e[0] };
  }
  return { prev, next };
}

/** Rings on the neighbours' points, with their place in the sewing order. */
export function drawNeighbors(ctx: CanvasRenderingContext2D, nb: { prev: Neighbor | null; next: Neighbor | null }, scale: number): void {
  for (const [m, kind] of [
    [nb.prev, "prev"],
    [nb.next, "next"],
  ] as const) {
    if (!m) continue;
    const r = 6 / scale;
    ctx.save();
    ctx.lineWidth = 2.5 / scale;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(m.p[0], m.p[1], r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = kind === "prev" ? "#d64545" : "#1f9d55";
    ctx.beginPath();
    ctx.arc(m.p[0], m.p[1], r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(m.p[0], m.p[1], 1.8 / scale, 0, Math.PI * 2);
    ctx.fill();
    // the neighbour's place in the sewing order: «‹3» before, «5›» after
    ctx.font = `700 ${10 / scale}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = kind === "prev" ? "right" : "left";
    const x = m.p[0] + (kind === "prev" ? -1 : 1) * (r + 2 / scale);
    const label = kind === "prev" ? `‹${m.n}` : `${m.n}›`;
    ctx.lineWidth = 3 / scale;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(label, x, m.p[1]);
    ctx.fillText(label, x, m.p[1]);
    ctx.restore();
  }
}
