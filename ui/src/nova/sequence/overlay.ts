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
