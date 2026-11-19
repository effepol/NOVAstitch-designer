// Module d — Views, needle path: tests d.1–d.4 (contract, section 4), on the
// drawing of a plan into a recording canvas and on the DST exported by Filum's engine.

import { check, done } from "../core/testkit";
import { FLAG, type PlanData } from "../../types";
import { exportDst } from "../sequence/dst";
import { drawNeedlePath } from "./draw";
import { DEFAULTS, type NeedlePathSettings } from "./settings";
import { needlePath } from "./path";
import { thousand, planOf } from "./fixture";

/** A canvas that records what is drawn (the context is in mm, as for a canvas layer). */
function recorder() {
  const calls: { op: string; args: number[]; lineWidth: number; style: string; dash: number[] }[] = [];
  const ctx = {
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    lineCap: "",
    lineJoin: "",
    dash: [] as number[],
    setLineDash(d: number[]) {
      ctx.dash = d;
    },
    save() {},
    restore() {},
    beginPath() {
      calls.push({ op: "beginPath", args: [], lineWidth: ctx.lineWidth, style: "", dash: [] });
    },
    moveTo(x: number, y: number) {
      calls.push({ op: "moveTo", args: [x, y], lineWidth: ctx.lineWidth, style: "", dash: [] });
    },
    lineTo(x: number, y: number) {
      calls.push({ op: "lineTo", args: [x, y], lineWidth: ctx.lineWidth, style: "", dash: [] });
    },
    stroke() {
      calls.push({ op: "stroke", args: [], lineWidth: ctx.lineWidth, style: String(ctx.strokeStyle), dash: [...ctx.dash] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: "fillRect", args: [x, y, w, h], lineWidth: ctx.lineWidth, style: String(ctx.fillStyle), dash: [] });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** The solid strokes (the sewing line), not the dashed uncut jumps. */
const solid = (calls: ReturnType<typeof recorder>["calls"]) => {
  const out: typeof calls = [];
  let path: typeof calls = [];
  for (const c of calls) {
    if (c.op === "beginPath") path = [];
    else if (c.op === "stroke") {
      if (!c.dash.length) out.push(...path, c);
    } else path.push(c);
  }
  return out;
};

const PX_PER_MM = 96 / 25.4;
const on = (s: Partial<NeedlePathSettings> = {}): NeedlePathSettings => ({ ...DEFAULTS, enabled: true, ...s });
/** A view k× with the whole design on screen. */
const view = (k: number) => ({ scale: k * PX_PER_MM, ox: 0, oy: 0, width: 100000, height: 100000, dpr: 1 });

// ---------------------------------------------------------------- d.1
{
  const { doc, plan } = thousand();
  const stitches = [...plan.flags].filter((f) => !(f & (FLAG.COMMANDS | FLAG.JUMP))).length;
  check(stitches >= 1000, `d.1 the design has at least 1,000 stitches (${stitches})`);
  const { ctx, calls } = recorder();
  drawNeedlePath(ctx, plan, view(1), on());
  const verts = solid(calls).filter((c) => c.op === "moveTo" || c.op === "lineTo").map((c) => c.args);
  // the plan's penetrations, in order
  const want: number[][] = [];
  for (let i = 0; i < plan.flags.length; i++) if (!(plan.flags[i] & (FLAG.COMMANDS | FLAG.JUMP))) want.push([plan.coords[2 * i], plan.coords[2 * i + 1]]);
  check(verts.length === want.length && verts.every((v, i) => v[0] === want[i][0] && v[1] === want[i][1]), `d.1 the line's vertices are the plan's points (${verts.length} of ${want.length})`);
  // to 0.1 mm they are the DST's stitches (placed by the first one)
  const dst = exportDst(doc).filter((r) => r.kind === "stitch");
  // as Filum's DST encoder rounds (crates/formats/src/encoder.rs): halves to even
  const r10 = (v: number) => {
    const u = v * 10;
    const f = Math.floor(u);
    return u - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(u);
  };
  const dx = dst[0].x - r10(want[0][0]);
  const dy = dst[0].y - r10(want[0][1]);
  const off = want.map((p, i) => [r10(p[0]) + dx - dst[i]?.x, r10(p[1]) + dy - dst[i]?.y]);
  const bad = off.filter((d) => Math.abs(d[0]) > 0 || Math.abs(d[1]) > 0).length;
  check(dst.length === want.length && bad === 0, `d.1 rounded to 0.1 mm the vertices are the DST's stitches (${want.length} vertices, ${dst.length} DST stitches, ${bad} apart)`);
}

// jumps, trims and colour changes are not sewing lines; each thread its colour
{
  const plan = planOf(
    [
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, FLAG.TRIM],
      [50, 50, FLAG.JUMP],
      [50, 60, 0],
      [60, 60, 0],
      [60, 60, FLAG.COLOR_CHANGE],
      [80, 80, FLAG.JUMP],
      [80, 90, 0],
      [90, 90, 0],
      [90, 90, FLAG.END],
    ],
    ["#ff0000", "#0000ff"],
  );
  const runs = needlePath(plan).runs;
  check(runs.length === 3, `d.1 a trim and a jump break the line (${runs.length} pieces)`);
  check(runs.map((r) => r.color).join() === "#ff0000,#ff0000,#0000ff", "d.1 each piece has its thread's colour");
  const { ctx, calls } = recorder();
  drawNeedlePath(ctx, plan, view(1), on());
  const segs: number[][] = [];
  let last: number[] | null = null;
  for (const c of solid(calls)) {
    if (c.op === "moveTo") last = c.args;
    if (c.op === "lineTo" && last) {
      segs.push([...last, ...c.args]);
      last = c.args;
    }
  }
  const crosses = segs.some((s) => (s[0] === 10 && s[2] === 50) || (s[0] === 60 && s[2] === 80) || (s[0] === 20 && s[2] === 50));
  check(!crosses, "d.1 no line along a jump");
  check(solid(calls).filter((c) => c.op === "stroke").map((c) => c.style).join() === "#ff0000,#0000ff", "d.1 one stroke per thread, in its colour");
  check(calls.every((c) => c.op !== "stroke" || !c.dash.length), "d.1 jumps the machine cuts are not drawn at all");
}

// hidden records (the finished view) and, on request, the underlay are left out, as Filum does
{
  const plan = planOf([
    [0, 0, 0],
    [5, 0, FLAG.UNDERLAY],
    [10, 0, 0],
    [15, 0, 0],
  ]);
  check(needlePath(plan, { showUnderlay: false }).dots.length / 2 === 3, "d.1 without the underlay its points are not drawn");
  const hidden: PlanData = { ...plan, hide: Uint8Array.from([0, 0, 1, 0]) };
  check(needlePath(hidden).dots.length / 2 === 3, "d.1 hidden records are not drawn");
}

// jumps the machine leaves uncut (Architect, 18/11): a thin dashed line in the
// thread's colour, not a sewing line; no dot where they land
{
  const recs = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, FLAG.TRIM],
    [30, 0, FLAG.JUMP],
    [40, 0, FLAG.JUMP],
    [40, 10, 0],
    [50, 10, 0],
    [50, 10, FLAG.TRIM],
    [70, 10, FLAG.JUMP],
    [70, 20, 0],
    [80, 20, 0],
  ];
  const plan: PlanData = { ...planOf(recs, ["#00aa00"]), uncut: { mask: Uint8Array.from([0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]), count: 1 } };
  const np = needlePath(plan);
  check(np.jumps.length === 1 && [...np.jumps[0].segs].join() === "10,0,30,0,30,0,40,0", `d.1 the uncut jumps are kept, from where the needle is to where it lands (${np.jumps.map((j) => [...j.segs].join()).join(" | ")})`);
  check(np.jumps[0].color === "#00aa00", "d.1 an uncut jump has its thread's colour");
  check(np.dots.length / 2 === 6, `d.1 no penetration where a jump lands (${np.dots.length / 2} of 6)`);
  for (const k of [0.5, 6]) {
    for (const w of [1, 3]) {
      const v = view(k);
      const { ctx, calls } = recorder();
      drawNeedlePath(ctx, plan, v, on({ widthPx: w }));
      const dashed = calls.filter((c) => c.op === "stroke" && c.dash.length);
      const line = solid(calls).filter((c) => c.op === "stroke");
      const px = dashed.map((c) => c.lineWidth * v.scale);
      const dashPx = dashed[0]?.dash.map((d) => d * v.scale) ?? [];
      check(
        dashed.length === 1 && dashed[0].style === "#00aa00" && px[0] <= Math.min(w, 1) + 1e-9 && px[0] <= line[0].lineWidth * v.scale + 1e-9 && dashPx.every((d) => Math.abs(d - dashPx[0]) < 1 + 1e-9 && d >= 2),
        `d.1 at ${k}×, line ${w} px: the uncut jump is dashed, thin (${px[0]?.toFixed(2)} px), the same in pixels at every zoom (${dashPx.map((d) => d.toFixed(1)).join("/")} px)`,
      );
    }
  }
}

// the stitch-out player: only the records sewn so far
{
  const plan = planOf([
    [0, 0, 0],
    [10, 0, 0],
    [20, 0, 0],
    [30, 0, 0],
  ]);
  const { ctx, calls } = recorder();
  drawNeedlePath(ctx, plan, view(1), on({ dots: true }), { limit: 2 });
  const verts = solid(calls).filter((c) => c.op === "moveTo" || c.op === "lineTo").map((c) => c.args[0]);
  check(verts.join() === "0,10" && calls.filter((c) => c.op === "fillRect").length === 2, `d.1 stitch-out at record 2: the line and the dots stop there (${verts.join()})`);
}

// ---------------------------------------------------------------- d.2
{
  const { plan } = thousand();
  for (const k of [0.5, 6]) {
    for (const w of [1, 2.5]) {
      const { ctx, calls } = recorder();
      const v = view(k);
      drawNeedlePath(ctx, plan, v, on({ widthPx: w }));
      const strokes = solid(calls).filter((c) => c.op === "stroke");
      const px = strokes.map((c) => c.lineWidth * v.scale);
      check(strokes.length > 0 && px.every((p) => Math.abs(p - w) < 1e-9), `d.2 width ${w} px at ${k}×: the line is ${[...new Set(px.map((p) => p.toFixed(3)))].join("/")} px`);
    }
  }
  check(DEFAULTS.widthPx === 1, "d.2 the default width is 1 px");
}

// ---------------------------------------------------------------- d.3
{
  const { plan } = thousand();
  const pts: number[][] = [];
  for (let i = 0; i < plan.flags.length; i++) if (!(plan.flags[i] & (FLAG.COMMANDS | FLAG.JUMP))) pts.push([plan.coords[2 * i], plan.coords[2 * i + 1]]);
  for (const k of [1, 0.5, 6]) {
    // the whole design on screen
    const all = recorder();
    drawNeedlePath(all.ctx, plan, view(k), on({ dots: true }));
    const dots = all.calls.filter((c) => c.op === "fillRect");
    check(dots.length === pts.length, `d.3 dots on at ${k}×: one dot per penetration (${dots.length} of ${pts.length})`);
    const centred = dots.every((d, i) => Math.abs(d.args[0] + d.args[2] / 2 - pts[i][0]) < 1e-6 && Math.abs(d.args[1] + d.args[3] / 2 - pts[i][1]) < 1e-6);
    check(centred, `d.3 at ${k}× each dot is on its penetration`);
    const size = dots.map((d) => d.args[2] * view(k).scale);
    check(size.every((s) => Math.abs(s - size[0]) < 1e-9 && s >= 2), `d.3 at ${k}× the dots are the same size in pixels (${size[0]?.toFixed(2)} px)`);
  }
  // only the visible ones: half the screen
  const v = view(1);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const half = { ...v, width: mid * v.scale };
  const r = recorder();
  drawNeedlePath(r.ctx, plan, half, on({ dots: true }));
  const drawn = r.calls.filter((c) => c.op === "fillRect");
  // a dot is visible when any of it is on screen
  const s = drawn[0] ? drawn[0].args[2] : 0;
  const seen = pts.filter((p) => p[0] - s / 2 <= mid).length;
  check(drawn.length === seen && seen < pts.length, `d.3 at 1× a dot for each visible penetration, none off screen (${drawn.length}, visible ${seen} of ${pts.length})`);
  // dots off: none
  const off = recorder();
  drawNeedlePath(off.ctx, plan, view(1), on({ dots: false }));
  check(off.calls.every((c) => c.op !== "fillRect"), "d.3 dots off: no dots");
}

// ---------------------------------------------------------------- d.4
{
  const { plan } = thousand();
  const { ctx, calls } = recorder();
  const drew = drawNeedlePath(ctx, plan, view(1), { ...DEFAULTS, enabled: false });
  check(!drew && calls.length === 0, "d.4 needle path off: nothing is drawn (Filum's stitch view stays as it is)");
  check(DEFAULTS.enabled === false, "d.4 the needle path starts off");
  const other = recorder();
  check(!drawNeedlePath(other.ctx, plan, { ...view(1), mode: "realistic" }, on()) && other.calls.length === 0, "d.4 only in the stitch view");
}

done("needle path");
