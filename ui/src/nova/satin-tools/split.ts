// Module m — «Dividi e dirigi»: on the selected shape the user draws cut
// lines (brown) and direction lines (red). m.split.apply cuts the shape where
// the cut lines cross it and turns each part into a two-rail satin whose
// stitches follow the part's direction line. Nothing is chosen by the
// program: where to cut and which way to sew is what the user drew; only a
// part without a line gets the direction across its long side (a warning in
// Studio; in Assisted there are no red lines, so every part is automatic).
//
// Filum's Cutter cuts a fill along the infinite line through two points, so a
// short cut on a letter would also cut far-away strokes and the result would
// depend on the order of the cuts. Here a cut works only along the segment the
// user drew: each stretch of it inside the shape (a chord) splits the shape
// there, or opens a counter (hole) when it runs from the edge into it.
//
// The parts overlap across each cut by the fabric preset's overlap (module e:
// flat hoop / cap frame; 0.2 mm without a preset), half on each side, so no gap
// opens between the satins when the fabric pulls.
//
// The satin of a part is an ordinary two-rail satin of Filum (rule of 25/11):
// the rails are the two sides of the part's outline between its cuts (the
// cuts are its ends; with one cut, the other end is halfway round the rest of
// the outline, the point farthest from the cut along it; with no cut, or with
// cuts along a side, the two ends that make the most slender column, a flat
// end taken whole). The rungs are node pairs across the column, point by
// point (an optimal alignment of the two rails that never goes back, weighing
// each rung's length and how much it leans along the column), so a curved
// part is sewn along its curve; a direction line is a rung where it lies. Every
// corner of the outline is a node, so the satin covers the part; only slivers a
// cut leaves on a side (folds of a fraction of a millimetre) are closed. The
// rails are never reversed by the engine (reverseRails "none"). A part that
// still has a counter (a closed ring) keeps the slices of the first version.
// Filum's own «Fill → satin» needs rung lines and runs in the engine's worker:
// a pure command cannot call it, so its rule (the ends of a section split at
// half its length) is followed here.

import type { DesignObject, SatinParams, StitchDocument, StitchParams, SubPath, Vec2 } from "../../types";
import type { NovaMode } from "../../types";
import { defaultStitch, flatten, uid } from "../../lib/geometry";
import { applyPlan } from "../../lib/convertActions";
import { newObjectDefaults } from "../presets/apply";
import { presetOf } from "../presets/registry";

export type Line = [Vec2, Vec2];

/** Params of m.split.apply. */
export interface SplitParams {
  /** The shape to split (a fill: closed outlines). */
  id: string;
  /** Cut lines (brown), each a segment; applied in order. */
  cuts: Line[];
  /** Direction lines (red): each sets the stitch angle of the part it lies in. */
  directions: Line[];
}

export interface SplitPlan {
  /** The document with the shape replaced by the satins. */
  doc: StitchDocument;
  /** How many parts (satins). */
  parts: number;
  /** Indices of the parts that got the automatic direction (no line in them). */
  auto: number[];
  /** Parts whose direction line meets the outline more than twice somewhere: sewn along the longest stretch. */
  notOneColumn: number[];
  /** Overlap used at the cuts (mm). */
  overlap: number;
  /** Ids of the new satins, in order. */
  made: string[];
}

/** Overlap between neighbouring parts: the preset's (flat / cap), else 0.2 mm. */
export function overlapFor(doc: StitchDocument): number {
  const p = presetOf(doc);
  if (!p) return 0.2;
  return doc.nova?.hoopKind === "cap" ? p.overlap.cap : p.overlap.flat;
}

/** Warnings (i18n keys) the tool shows after the split, by mode. */
export function splitWarnings(plan: SplitPlan, mode: NovaMode): string[] {
  const out: string[] = [];
  if (mode === "studio" && plan.auto.length) out.push("m.split.autoDirection");
  if (plan.notOneColumn.length) out.push("m.split.notOneColumn");
  return out;
}

// ---------------------------------------------------------------------------
// Plane helpers

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);
const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-12 ? [0, 0] : [a[0] / l, a[1] / l];
};
const midOf = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** A vertex of a ring; `tag` marks where a cut crosses the outline. */
interface V {
  p: Vec2;
  tag?: number;
}
type Ring = V[];
/** A part of the shape: one outline (counter-clockwise) and its counters (clockwise). */
interface Region {
  outer: Ring;
  holes: Ring[];
}

function signedArea(r: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += cross(r[i], r[(i + 1) % r.length]);
  return s / 2;
}

/** Even-odd test against rings. */
function insideRings(rings: Vec2[][], q: Vec2): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = [r[i], r[j]];
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  return c;
}
const pts = (r: Ring) => r.map((v) => v.p);
const insideRegion = (g: Region, q: Vec2) => insideRings([pts(g.outer), ...g.holes.map(pts)], q);
const regionArea = (g: Region) => Math.abs(signedArea(pts(g.outer))) - g.holes.reduce((s, h) => s + Math.abs(signedArea(pts(h))), 0);

/** The shape's closed outlines as regions: each outline with the counters inside it. */
export function regionsOf(o: DesignObject): Region[] {
  const rings = o.paths
    .filter((sp) => sp.closed && sp.nodes.length >= 3)
    .map((sp) => {
      const r = flatten(sp, 16);
      if (r.length > 2 && len(sub(r[0], r[r.length - 1])) < 1e-9) r.pop();
      return r.filter((p, i) => i === 0 || len(sub(p, r[i - 1])) > 1e-9);
    })
    .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 1e-9);
  // depth: how many other outlines hold the ring; even = outline, odd = counter
  const depth = rings.map((r, i) => rings.filter((q, j) => j !== i && insideRings([q], r[0])).length);
  const orient = (r: Vec2[], ccw: boolean): Ring => ((signedArea(r) > 0) === ccw ? r : [...r].reverse()).map((p) => ({ p }));
  const outers = rings.map((r, i) => ({ r, i })).filter(({ i }) => depth[i] % 2 === 0);
  const regions: Region[] = outers.map(({ r }) => ({ outer: orient(r, true), holes: [] }));
  rings.forEach((r, i) => {
    if (depth[i] % 2 === 0) return;
    // the smallest outline holding it
    let best = -1;
    outers.forEach(({ r: q }, k) => {
      if (insideRings([q], r[0]) && (best < 0 || Math.abs(signedArea(q)) < Math.abs(signedArea(outers[best].r)))) best = k;
    });
    if (best >= 0) regions[best].holes.push(orient(r, false));
  });
  return regions;
}

// ---------------------------------------------------------------------------
// Cutting along a segment

interface Hit {
  ring: number; // 0 = outer, 1.. = holes
  edge: number;
  te: number; // along the edge
  ts: number; // along the cut
  p: Vec2;
}

/** Where segment a→b crosses the region's outlines, along the cut. */
function hitsOf(g: Region, a: Vec2, b: Vec2): Hit[] {
  const rings = [g.outer, ...g.holes];
  const d = sub(b, a);
  const out: Hit[] = [];
  rings.forEach((r, ri) => {
    for (let i = 0; i < r.length; i++) {
      const p = r[i].p;
      const q = r[(i + 1) % r.length].p;
      const e = sub(q, p);
      const den = cross(d, e);
      if (Math.abs(den) < 1e-12) continue;
      const w = sub(p, a);
      const ts = cross(w, e) / den;
      const te = cross(w, d) / den;
      if (ts < 0 || ts > 1 || te < 0 || te >= 1) continue;
      out.push({ ring: ri, edge: i, te, ts, p: add(a, mul(d, ts)) });
    }
  });
  return out.sort((x, y) => x.ts - y.ts);
}

/** The stretches of the cut inside the region, in order along it (empty: the cut misses it). */
function chordsOf(g: Region, a: Vec2, b: Vec2): [Hit, Hit][] {
  const hits = hitsOf(g, a, b);
  const out: [Hit, Hit][] = [];
  for (let k = 0; k + 1 < hits.length; k++) {
    const [h0, h1] = [hits[k], hits[k + 1]];
    if (h1.ts - h0.ts < 1e-9) continue;
    if (insideRegion(g, midOf(h0.p, h1.p))) out.push([h0, h1]);
  }
  return out;
}

/** Split region g along the segment a→b: each chord splits an outline or opens a counter. */
function splitRegion(g: Region, a: Vec2, b: Vec2): Region[] {
  const chords = chordsOf(g, a, b);
  if (!chords.length) return [g];
  // put every chord end into its ring as a tagged vertex
  const rings: Ring[] = [g.outer, ...g.holes].map((r) => r.map((v) => ({ p: v.p })));
  const byRing = new Map<number, { edge: number; te: number; tag: number; p: Vec2 }[]>();
  chords.forEach(([h0, h1], k) => {
    for (const [h, tag] of [
      [h0, 2 * k],
      [h1, 2 * k + 1],
    ] as const) {
      if (!byRing.has(h.ring)) byRing.set(h.ring, []);
      byRing.get(h.ring)!.push({ edge: h.edge, te: h.te, tag, p: h.p });
    }
  });
  for (const [ri, list] of byRing) {
    list.sort((x, y) => x.edge - y.edge || x.te - y.te);
    const r = rings[ri];
    const out: Ring = [];
    let k = 0;
    for (let i = 0; i < r.length; i++) {
      out.push(r[i]);
      while (k < list.length && list[k].edge === i) {
        out.push({ p: list[k].p, tag: list[k].tag });
        k++;
      }
    }
    rings[ri] = out;
  }
  let parts: Region[] = [{ outer: rings[0], holes: rings.slice(1) }];
  chords.forEach((_, k) => {
    const [tx, ty] = [2 * k, 2 * k + 1];
    const find = (rg: Region, tag: number) => {
      const all = [rg.outer, ...rg.holes];
      for (let ri = 0; ri < all.length; ri++) {
        const vi = all[ri].findIndex((v) => v.tag === tag);
        if (vi >= 0) return { ri, vi };
      }
      return null;
    };
    const pi = parts.findIndex((rg) => find(rg, tx) && find(rg, ty));
    if (pi < 0) return;
    const rg = parts[pi];
    const X = find(rg, tx)!;
    const Y = find(rg, ty)!;
    const all = [rg.outer, ...rg.holes];
    if (X.ri === Y.ri) {
      // a chord across the outline: two parts, each counter goes with the part holding it
      if (X.ri !== 0) return;
      const r = rg.outer;
      const [i, j] = X.vi < Y.vi ? [X.vi, Y.vi] : [Y.vi, X.vi];
      const ra = r.slice(i, j + 1);
      const rb = [...r.slice(j), ...r.slice(0, i + 1)];
      const holesOf = (q: Ring) => rg.holes.filter((h) => insideRings([pts(q)], h[0].p));
      parts.splice(pi, 1, { outer: ra, holes: holesOf(ra) }, { outer: rb, holes: holesOf(rb) });
      return;
    }
    // a chord from one outline to another: the two join through it (a counter opens)
    const [P, Q] = X.ri < Y.ri ? [X, Y] : [Y, X];
    const rp = all[P.ri];
    const rq = all[Q.ri];
    const joined: Ring = [...rp.slice(0, P.vi + 1), ...rq.slice(Q.vi), ...rq.slice(0, Q.vi + 1), { p: rp[P.vi].p }, ...rp.slice(P.vi + 1)];
    const rest = all.filter((_, ri) => ri !== P.ri && ri !== Q.ri);
    parts[pi] = P.ri === 0 ? { outer: joined, holes: rest.slice(0) } : { outer: rg.outer, holes: [...rg.holes.filter((h) => h !== rp && h !== rq), joined] };
  });
  return parts.filter((rg) => regionArea(rg) > 1e-4);
}

/**
 * Cut every part the segment crosses, the parts passing the cut by half the
 * overlap each: the side ahead of the cut is cut a half-overlap behind it and
 * the other way round, and of each cut only the parts touching the drawn cut
 * are kept.
 */
function cutParts(parts: Region[], cut: Line, overlap: number): Region[] {
  const [a, b] = cut;
  const n = unit([-(b[1] - a[1]), b[0] - a[0]]);
  if (!(len(sub(b, a)) > 1e-9)) return parts;
  return parts.flatMap((g) => {
    const chords = chordsOf(g, a, b);
    if (!chords.length) return [g];
    const plain = splitRegion(g, a, b);
    if (!(overlap > 0) || plain.length < 2) return plain;
    const mids = chords.map(([h0, h1]) => midOf(h0.p, h1.p));
    const h = overlap / 2;
    const side = (k: number) => {
      const off = mul(n, k * h);
      const pieces = splitRegion(g, add(a, off), add(b, off));
      return pieces.length < 2 ? null : pieces.filter((rg) => mids.some((m) => insideRegion(rg, m)));
    };
    // shifted back: the parts ahead, grown back over the cut; shifted ahead: the parts behind
    const ahead = side(-1);
    const behind = side(1);
    if (!ahead || !behind) return plain;
    return [...ahead, ...behind];
  });
}

// ---------------------------------------------------------------------------
// Directions

/** Stitch direction across the part's long side: the narrowest box around it (rotating calipers on the hull). */
function autoDirection(g: Region): Vec2 {
  const P = [...pts(g.outer)].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const half = (list: Vec2[]) => {
    const h: Vec2[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(p, h[h.length - 2])) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hull = [...half(P), ...half([...P].reverse())];
  let best = { area: Infinity, long: [1, 0] as Vec2 };
  for (let i = 0; i < hull.length; i++) {
    const e = unit(sub(hull[(i + 1) % hull.length], hull[i]));
    if (!e[0] && !e[1]) continue;
    const nrm: Vec2 = [-e[1], e[0]];
    const us = hull.map((p) => dot(p, e));
    const vs = hull.map((p) => dot(p, nrm));
    const du = Math.max(...us) - Math.min(...us);
    const dv = Math.max(...vs) - Math.min(...vs);
    if (du * dv < best.area - 1e-9) best = { area: du * dv, long: du >= dv ? e : nrm };
  }
  return [-best.long[1], best.long[0]];
}

/** The part a direction line belongs to: the one holding most of it. */
function partOfLine(parts: Region[], l: Line): number {
  let best = -1;
  let most = 0;
  parts.forEach((g, k) => {
    let n = 0;
    for (let i = 0; i <= 20; i++) if (insideRegion(g, add(l[0], mul(sub(l[1], l[0]), i / 20)))) n++;
    if (n > most) {
      most = n;
      best = k;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// A part → two rails

const EPS = 1e-7;

/**
 * Rails of a part sewn along `d`: slices of the part parallel to d at every
 * corner of its outline (a hair before and after, so a step in the outline
 * keeps the rails on it); rail 1 the start of each slice, rail 2 its end.
 * Corners on a straight stretch of both rails are dropped.
 */
function railsOf(g: Region, dir: Vec2): { rails: [Vec2[], Vec2[]]; oneColumn: boolean } | null {
  const d = unit(dir);
  const u: Vec2 = [-d[1], d[0]];
  const rings = [g.outer, ...g.holes].map(pts);
  const ss = [...new Set(rings.flat().map((p) => dot(p, u)))].sort((x, y) => x - y);
  const s0 = ss[0];
  const s1 = ss[ss.length - 1];
  if (!(s1 - s0 > 1e-6)) return null;
  const at: number[] = [];
  for (const s of ss) {
    if (s > s0) at.push(s - EPS);
    if (s < s1) at.push(s + EPS);
  }
  let oneColumn = true;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (const s of at) {
    const vs: number[] = [];
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const p = r[i];
        const q = r[(i + 1) % r.length];
        const [ps, qs] = [dot(p, u), dot(q, u)];
        if ((ps <= s && s < qs) || (qs <= s && s < ps)) {
          const t = (s - ps) / (qs - ps);
          vs.push(dot(add(p, mul(sub(q, p), t)), d));
        }
      }
    vs.sort((x, y) => x - y);
    let spans: [number, number][] = [];
    for (let k = 0; k + 1 < vs.length; k += 2) spans.push([vs[k], vs[k + 1]]);
    const real = spans.filter(([x, y]) => y - x > 1e-6);
    if (real.length > 1) oneColumn = false;
    if (real.length) spans = real;
    if (!spans.length) continue;
    const [v0, v1] = spans.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
    left.push(add(mul(u, s), mul(d, v0)));
    right.push(add(mul(u, s), mul(d, v1)));
  }
  // drop slices on a straight stretch of both rails
  const offLine = (p: Vec2, a: Vec2, b: Vec2) => {
    const e = sub(b, a);
    const l = len(e);
    return l < 1e-12 ? len(sub(p, a)) : Math.abs(cross(e, sub(p, a))) / l;
  };
  for (let k = 1; k < left.length - 1; ) {
    if (offLine(left[k], left[k - 1], left[k + 1]) < 1e-5 && offLine(right[k], right[k - 1], right[k + 1]) < 1e-5) {
      left.splice(k, 1);
      right.splice(k, 1);
    } else k++;
  }
  if (left.length < 2) return null;
  return { rails: [left, right], oneColumn };
}

// ---------------------------------------------------------------------------
// A part → a column: the rails are the two sides of its outline

/** Arc length along a polyline (or a ring, closing it). */
function cumulative(p: Vec2[], closed = false): number[] {
  const c = [0];
  for (let i = 1; i < p.length; i++) c.push(c[i - 1] + len(sub(p[i], p[i - 1])));
  if (closed) c.push(c[c.length - 1] + len(sub(p[0], p[p.length - 1])));
  return c;
}

/** The point at arc length d along a polyline. */
function pointAt(p: Vec2[], c: number[], d: number): Vec2 {
  const total = c[c.length - 1];
  const x = Math.max(0, Math.min(total, d));
  let lo = 0;
  let hi = c.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c[m] <= x) lo = m;
    else hi = m;
  }
  const seg = c[hi] - c[lo];
  const q = p[hi % p.length];
  return seg < 1e-12 ? p[lo] : add(p[lo], mul(sub(q, p[lo]), (x - c[lo]) / seg));
}

/** A closed outline walked by arc length. */
class Outline {
  readonly c: number[];
  readonly L: number;
  constructor(readonly p: Vec2[]) {
    this.c = cumulative(p, true);
    this.L = this.c[this.c.length - 1];
  }
  at(d: number): Vec2 {
    const x = ((d % this.L) + this.L) % this.L;
    return pointAt(this.p, this.c, x);
  }
  /** The outline from `from` forward to `to` (arc positions; `to` may pass the start), with its corners. */
  arc(from: number, to: number): Vec2[] {
    while (to < from) to += this.L;
    const out: Vec2[] = [this.at(from)];
    const n = this.p.length;
    for (let lap = 0; lap < 2; lap++)
      for (let i = 0; i < n; i++) {
        const d = this.c[i] + lap * this.L;
        if (d > from + 1e-9 && d < to - 1e-9) out.push(this.p[i]);
      }
    out.push(this.at(to));
    return out.filter((q, i) => i === 0 || len(sub(q, out[i - 1])) > 1e-9);
  }
}

/**
 * How good two rails are as a column: their mean distance, matched by share
 * of length, over the length of their middle line. A column is narrow and long.
 */
function slenderness(a: Vec2[], b: Vec2[]): number {
  const ca = cumulative(a);
  const cb = cumulative(b);
  const K = 24;
  let w = 0;
  let along = 0;
  let prev: Vec2 | null = null;
  for (let k = 0; k <= K; k++) {
    const p = pointAt(a, ca, (ca[ca.length - 1] * k) / K);
    const q = pointAt(b, cb, (cb[cb.length - 1] * k) / K);
    w += len(sub(p, q));
    const m = midOf(p, q);
    if (prev) along += len(sub(m, prev));
    prev = m;
  }
  return w / (K + 1) / Math.max(along, 1e-9);
}

/** Stretches of the outline lying on a cut line (the part's cut ends), as arc positions [start, end]. */
function cutRuns(o: Outline, cutLines: Line[]): [number, number][] {
  const n = o.p.length;
  const onCut = (i: number) => {
    const p = o.p[i];
    const q = o.p[(i + 1) % n];
    if (len(sub(q, p)) < 1e-9) return false;
    return cutLines.some(([a, b]) => {
      const d = sub(b, a);
      const l = len(d);
      if (l < 1e-9) return false;
      const off = (r: Vec2) => Math.abs(cross(d, sub(r, a))) / l;
      const t = dot(sub(midOf(p, q), a), d) / (l * l);
      return off(p) < 1e-6 && off(q) < 1e-6 && t > -1e-6 && t < 1 + 1e-6;
    });
  };
  const flags = Array.from({ length: n }, (_, i) => onCut(i));
  if (flags.every(Boolean) || !flags.some(Boolean)) return [];
  // start the walk after a stretch that is not a cut
  const first = flags.findIndex((f, i) => f && !flags[(i - 1 + n) % n]);
  const runs: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const i = (first + k) % n;
    if (!flags[i]) continue;
    const startD = o.c[i];
    const endD = o.c[i + 1];
    const last = runs[runs.length - 1];
    if (last && flags[(i - 1 + n) % n] && k > 0) last[1] = endD < last[1] ? endD + o.L : endD;
    else runs.push([startD, endD]);
  }
  return runs;
}

type Rails = [Vec2[], Vec2[]];

/** Length of the middle line of two rails matched by share of length. */
function midLength(a: Vec2[], b: Vec2[]): number {
  const ca = cumulative(a);
  const cb = cumulative(b);
  const K = 24;
  let along = 0;
  let prev: Vec2 | null = null;
  for (let k = 0; k <= K; k++) {
    const m = midOf(pointAt(a, ca, (ca[ca.length - 1] * k) / K), pointAt(b, cb, (cb[cb.length - 1] * k) / K));
    if (prev) along += len(sub(m, prev));
    prev = m;
  }
  return along;
}

/**
 * The end of a column near the outline point at `d`: a flat end, that is a
 * side between two corners (a turn of more than 45°), no longer than `reach`,
 * starting within `reach` of the point and lying across the column (at least
 * 60° from the way from its middle to `inner`, a point of the column's middle
 * line a little way in) and not `banned` (a cut along a side); else the point itself.
 */
function endStretch(o: Outline, d: number, reach: number, inner: Vec2, banned: (d: number) => boolean): [number, number] {
  const n = o.p.length;
  const corner = (i: number) => {
    const u = unit(sub(o.p[i], o.p[(i - 1 + n) % n]));
    const v = unit(sub(o.p[(i + 1) % n], o.p[i]));
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) > Math.PI / 4;
  };
  const cs = o.p.map((_, i) => i).filter(corner).map((i) => o.c[i]);
  if (cs.length < 2) return [d, d];
  const x = ((d % o.L) + o.L) % o.L;
  let best: { r: [number, number]; across: number } | null = null;
  for (let k = 0; k < cs.length; k++) {
    const s0 = cs[k];
    let s1 = cs[(k + 1) % cs.length];
    if (s1 <= s0) s1 += o.L;
    if (s1 - s0 > reach || banned((s0 + s1) / 2)) continue;
    // how far the point is from this side, along the outline
    const into = (((x - s0) % o.L) + o.L) % o.L;
    const gap = into <= s1 - s0 ? 0 : Math.min(into - (s1 - s0), o.L - into);
    if (gap > reach / 2) continue;
    const across = Math.abs(dot(unit(sub(o.at(s1), o.at(s0))), unit(sub(inner, midOf(o.at(s0), o.at(s1))))));
    if (across >= 0.5) continue;
    if (!best || across < best.across) best = { r: [s0, s1], across };
  }
  if (!best) return [d, d];
  const shift = d - x;
  // the side as positions around the point (the start not after it by more than a lap)
  let [r0, r1] = best.r;
  while (r0 - x > o.L / 2) (r0 -= o.L), (r1 -= o.L);
  while (x - r0 > o.L / 2) (r0 += o.L), (r1 += o.L);
  return [r0 + shift, r1 + shift];
}

/** Rails from the ends: rail 1 from the first end to the second along one side, rail 2 along the other. */
function railsBetween(o: Outline, e1: [number, number], e2: [number, number]): Rails {
  // e = [start, end] of an end stretch, in the outline's direction
  return [o.arc(e1[1], e2[0]), o.arc(e2[1], e1[0] + o.L).reverse()];
}

/**
 * Where the column's ends are: the cuts (two cuts: the sides between them;
 * one cut: the other end halfway round the rest of the outline, the point
 * farthest from the cut along it). Without cuts, or with cuts along a side of
 * the part rather than at its ends, the two points of the outline that make
 * the most slender column (narrow for its length).
 */
function columnRails(o: Outline, runs: [number, number][]): Rails {
  const byCuts = (): Rails | null => {
    if (runs.length === 2) return railsBetween(o, runs[0], runs[1]);
    if (runs.length === 1) {
      const [s, e] = runs[0];
      const far = e + (s + o.L - e) / 2;
      return railsBetween(o, runs[0], [far, far]);
    }
    return null;
  };
  // the most slender column over all pairs of ends (coarse, then finer); an end is
  // never on a cut, which here runs along a side of the part
  const onRun = (d: number) =>
    runs.some(([a, b]) => {
      const x = (((d - a) % o.L) + o.L) % o.L;
      return x <= b - a + 1 || x >= o.L - 1;
    });
  const free = (): Rails => {
    const N = 72;
    const score = (s: number, t: number) => {
      const K = 16;
      const span = ((t - s) % o.L + o.L) % o.L;
      let w = 0;
      let along = 0;
      let prev: Vec2 | null = null;
      for (let k = 0; k <= K; k++) {
        const p = o.at(s + (span * k) / K);
        const q = o.at(s - ((o.L - span) * k) / K);
        w += len(sub(p, q));
        const m = midOf(p, q);
        if (prev) along += len(sub(m, prev));
        prev = m;
      }
      return w / (K + 1) / Math.max(along, 1e-9);
    };
    let best = { s: 0, t: o.L / 2, v: Infinity };
    const consider = (s: number, t: number) => {
      if (onRun(s) || onRun(t)) return;
      const v = score(s, t);
      if (v < best.v) best = { s, t, v };
    };
    for (let i = 0; i < N; i++) for (let j = Math.ceil(N * 0.2); j <= Math.floor(N * 0.8); j++) consider((o.L * i) / N, (o.L * (i + j)) / N);
    for (let round = 0; round < 3; round++) {
      const h = o.L / N / Math.pow(4, round);
      const b0 = best;
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) consider(b0.s + (i * h) / 2, b0.t + (j * h) / 2);
    }
    // a flat end (between two corners near the end point) is an end edge, not a point
    const r = railsBetween(o, [best.s, best.s], [best.t, best.t]);
    const along = midLength(r[0], r[1]);
    const width = slenderness(r[0], r[1]) * along;
    const reach = 1.5 * width;
    // the column's direction at each end: from the end to its middle about one width in
    const f = Math.max(0.02, Math.min(0.25, width / Math.max(along, 1e-9)));
    const ca = cumulative(r[0]);
    const cb = cumulative(r[1]);
    const inAt = (f: number) => midOf(pointAt(r[0], ca, ca[ca.length - 1] * f), pointAt(r[1], cb, cb[cb.length - 1] * f));
    const e1 = endStretch(o, best.s, reach, inAt(f), onRun);
    const e2 = endStretch(o, best.t, reach, inAt(1 - f), onRun);
    return railsBetween(o, e1, e2);
  };
  const cut = byCuts();
  if (!cut) return free();
  // cuts along a side (a branch cut off the side of a stroke) are not its ends
  const alt = free();
  return slenderness(cut[0], cut[1]) > 1.5 * slenderness(alt[0], alt[1]) ? alt : cut;
}

/** Hits of the line through m along n with a polyline: arc position on it and distance along the line. */
function lineHits(m: Vec2, n: Vec2, p: Vec2[], c: number[]): { d: number; s: number }[] {
  const out: { d: number; s: number }[] = [];
  for (let i = 1; i < p.length; i++) {
    const e = sub(p[i], p[i - 1]);
    const den = cross(n, e);
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(p[i - 1], m);
    const s = cross(w, e) / den;
    const u = cross(w, n) / den;
    if (u < -1e-9 || u > 1 + 1e-9) continue;
    out.push({ d: c[i - 1] + u * (c[i] - c[i - 1]), s });
  }
  return out;
}

/** Arc positions sampled along a polyline: evenly, plus every corner. */
function samples(c: number[], step: number): number[] {
  const L = c[c.length - 1];
  const n = Math.max(2, Math.min(1200, Math.ceil(L / step)));
  const out = new Set<number>();
  for (let k = 0; k <= n; k++) out.add((L * k) / n);
  for (const d of c) out.add(d);
  return [...out].sort((x, y) => x - y).filter((d, i, arr) => i === 0 || d - arr[i - 1] > 1e-7);
}

/**
 * Node pairs (rungs) across the column, as arc positions on both rails: the
 * shortest way to pair the two rails from end to end without ever going back
 * on either (an optimal alignment), so the rungs never cross and lie across
 * the column point by point; every corner of both rails is a node; each
 * direction line is a rung where it lies (the path goes through it).
 */
function pairRails(a: Vec2[], b: Vec2[], directions: Line[], middle: Vec2[] | null): { pairs: [number, number][]; forced: [number, number][] } {
  const ca = cumulative(a);
  const cb = cumulative(b);
  const step = Math.max(0.15, Math.max(ca[ca.length - 1], cb[cb.length - 1]) / 1000);
  // each direction line is a rung where it lies: where its line meets the two rails
  const forced: [number, number][] = [];
  for (const l of directions) {
    const mid = midOf(l[0], l[1]);
    const dir = unit(sub(l[1], l[0]));
    const near = (hits: { d: number; s: number }[]) => (hits.length ? hits.reduce((p, q) => (Math.abs(q.s) < Math.abs(p.s) ? q : p)).d : null);
    const x = near(lineHits(mid, dir, a, ca));
    const y = near(lineHits(mid, dir, b, cb));
    // lines that would cross one another keep the first
    if (x !== null && y !== null && forced.every(([p, q]) => (p - x) * (q - y) > 0)) forced.push([x, y]);
  }
  const sa = [...new Set([...samples(ca, step), ...forced.map((f) => f[0])])].sort((p, q) => p - q);
  const sb = [...new Set([...samples(cb, step), ...forced.map((f) => f[1])])].sort((p, q) => p - q);
  const fixed = forced.map(([x, y]) => [sa.indexOf(x), sb.indexOf(y)] as [number, number]);
  // the path goes through each such rung: every cell is wholly before it or wholly after it,
  // and no diagonal step jumps from before to after past it
  const barred = (i: number, j: number) => fixed.some(([fi, fj]) => !((i <= fi && j <= fj) || (i >= fi && j >= fj)));
  const jumps = (i: number, j: number) =>
    fixed.some(([fi, fj]) => {
      const before = i - 1 <= fi && j - 1 <= fj && !(i - 1 === fi && j - 1 === fj);
      const after = i >= fi && j >= fj && !(i === fi && j === fj);
      return before && after;
    });
  const pa = sa.map((d) => pointAt(a, ca, d));
  const pb = sb.map((d) => pointAt(b, cb, d));
  const n = sa.length;
  const m = sb.length;
  // the column's direction where a rung would be: along the middle line given
  // (none: rungs are weighed by their length only)
  const LA = ca[ca.length - 1];
  const LB = cb[cb.length - 1];
  const mc = middle ? cumulative(middle) : [0];
  const ML = mc[mc.length - 1];
  const reachT = Math.max(0.5, ML / 40);
  const T = 1024;
  const table = Array.from({ length: T + 1 }, (_, k): Vec2 => (middle ? unit(sub(pointAt(middle, mc, (k / T) * ML + reachT), pointAt(middle, mc, (k / T) * ML - reachT))) : [0, 0]));
  const tangent = (f: number): Vec2 => table[Math.max(0, Math.min(T, Math.round(f * T)))];
  const tA = sa.map((d) => d / Math.max(LA, 1e-12));
  const tB = sb.map((d) => d / Math.max(LB, 1e-12));
  const cost = new Float64Array(n * m);
  const from = new Uint8Array(n * m); // 0 diagonal, 1 from i-1, 2 from j-1
  // each step costs that (squared length, leaning) times the stretch of rail it
  // moves along: whatever the sampling, short rungs across the column win
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      if (!i && !j) continue;
      if (barred(i, j)) {
        cost[i * m + j] = Infinity;
        continue;
      }
      // squared length, more for a rung that leans along the column
      const r = sub(pb[j], pa[i]);
      const w = len(r);
      const lean = w < 1e-9 ? 0 : dot(r, tangent((tA[i] + tB[j]) / 2)) / w;
      const here = w * w * (1 + 8 * lean * lean);
      const da = i ? sa[i] - sa[i - 1] : 0;
      const db = j ? sb[j] - sb[j - 1] : 0;
      let best = Infinity;
      let way = 0;
      if (i && j && !jumps(i, j)) {
        const c = cost[(i - 1) * m + j - 1] + here * (da + db);
        if (c < best) (best = c), (way = 0);
      }
      if (i) {
        const c = cost[(i - 1) * m + j] + here * da;
        if (c < best) (best = c), (way = 1);
      }
      if (j) {
        const c = cost[i * m + j - 1] + here * db;
        if (c < best) (best = c), (way = 2);
      }
      cost[i * m + j] = best;
      from[i * m + j] = way;
    }
  let pairs: [number, number][] = [];
  for (let i = n - 1, j = m - 1; ; ) {
    pairs.push([sa[i], sb[j]]);
    if (!i && !j) break;
    const w = from[i * m + j];
    if (w === 0) (i--, j--);
    else if (w === 1) i--;
    else j--;
  }
  pairs.reverse();
  return { pairs, forced };
}

/** Drop rungs on straight stretches of both rails where the rung turns evenly (they add nothing); `keep`: rungs that stay. */
function thin(a: Vec2[], b: Vec2[], keep: boolean[] = []): Rails {
  const A = [...a];
  const B = [...b];
  const K = [...keep];
  const off = (p: Vec2, s: Vec2, e: Vec2) => {
    const d = sub(e, s);
    const l = len(d);
    return l < 1e-12 ? len(sub(p, s)) : Math.abs(cross(d, sub(p, s))) / l;
  };
  for (let k = 1; k < A.length - 1; ) {
    const ta = len(sub(A[k], A[k - 1])) / Math.max(1e-12, len(sub(A[k + 1], A[k - 1])));
    const tb = len(sub(B[k], B[k - 1])) / Math.max(1e-12, len(sub(B[k + 1], B[k - 1])));
    if (!K[k] && off(A[k], A[k - 1], A[k + 1]) < 1e-4 && off(B[k], B[k - 1], B[k + 1]) < 1e-4 && Math.abs(ta - tb) < 0.02) {
      A.splice(k, 1);
      B.splice(k, 1);
      K.splice(k, 1);
    } else k++;
  }
  return [A, B];
}

/**
 * A rail without its folds. Where the rail turns back along the column (a
 * sliver the cut left on the side, no deeper than `deepest`) no rung could lie
 * across the column, so the fold is closed with a short chord: across its tip
 * or across its hollow, whichever lies inside the part (nothing is sewn
 * outside the shape; the sliver cut off stays covered by the overlap).
 */
function unfold(rail: Vec2[], mids: Vec2[], inside: (q: Vec2) => boolean, deepest: number): Vec2[] {
  // the column's direction near a point: that of the nearest stretch of the middle line
  const towards = (q: Vec2): Vec2 => {
    let best = Infinity;
    let dir: Vec2 = [0, 0];
    for (let i = 1; i < mids.length; i++) {
      const e = sub(mids[i], mids[i - 1]);
      const l2 = dot(e, e);
      if (l2 < 1e-18) continue;
      const t = Math.max(0, Math.min(1, dot(sub(q, mids[i - 1]), e) / l2));
      const d = len(sub(q, add(mids[i - 1], mul(e, t))));
      if (d < best) (best = d), (dir = mul(e, 1 / Math.sqrt(l2)));
    }
    return dir;
  };
  // how far along the column the rail has come at each corner, step by step
  const progress = (r: Vec2[]) => {
    const u = [0];
    for (let i = 1; i < r.length; i++) u.push(u[i - 1] + dot(sub(r[i], r[i - 1]), towards(midOf(r[i], r[i - 1]))));
    return u;
  };
  let r = [...rail];
  let from = 1;
  for (let round = 0; round < 200; round++) {
    const u = progress(r);
    // the next turn back: the peak P, then down to the hollow V, then up past P again
    let p = -1;
    for (let i = from; i < u.length; i++)
      if (u[i] < u[i - 1] - 1e-6) {
        p = i - 1;
        break;
      }
    if (p < 0) return r;
    let v = p + 1;
    while (v + 1 < u.length && u[v + 1] <= u[v]) v++;
    let k = v + 1;
    while (k < u.length && u[k] < u[p]) k++;
    if (u[p] - u[v] > deepest) {
      // a real part of the shape (a foot, a branch), not a sliver: it stays
      from = v + 1;
      continue;
    }
    // closing across the hollow: from P to where the rail comes back to P's level
    const cut = (i: number, j: number, level: number): Vec2 => add(r[i], mul(sub(r[j], r[i]), (level - u[i]) / (u[j] - u[i] || 1)));
    const hollow = k < u.length ? { at: cut(k - 1, k, u[p]), from: p, to: k } : null;
    // closing across the tip: from where the rail rose to V's level before P, to V
    let j = p;
    while (j > 0 && u[j - 1] > u[v]) j--;
    const tip = j > 0 ? { at: cut(j - 1, j, u[v]), from: j, to: v } : null;
    const ok = (a: Vec2, b: Vec2) => inside(midOf(a, b));
    if (hollow && ok(r[p], hollow.at)) r = [...r.slice(0, p + 1), hollow.at, ...r.slice(k)];
    else if (tip && ok(tip.at, r[v])) r = [...r.slice(0, j), tip.at, ...r.slice(v)];
    else from = v + 1; // this one cannot be closed inside the part: leave it
  }
  return r;
}

/** Whether two segments cross (touching at an end does not count). */
function segmentsCross(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const e = 1e-9;
  const d1 = cross(sub(q2, q1), sub(p1, q1));
  const d2 = cross(sub(q2, q1), sub(p2, q1));
  const d3 = cross(sub(p2, p1), sub(q1, p1));
  const d4 = cross(sub(p2, p1), sub(q2, p1));
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}

/** The middle line of paired rails, evened out over about a millimetre. */
function middleLine(a: Vec2[], b: Vec2[], pairs: [number, number][]): Vec2[] {
  const ca = cumulative(a);
  const cb = cumulative(b);
  const raw = pairs.map(([x, y]) => midOf(pointAt(a, ca, x), pointAt(b, cb, y))).filter((q, i, arr) => i === 0 || len(sub(q, arr[i - 1])) > 1e-9);
  const rc = cumulative(raw);
  const L = rc[rc.length - 1];
  if (raw.length < 2 || L < 1e-9) return raw.length ? raw : [a[0], a[a.length - 1]];
  const N = Math.max(10, Math.min(400, Math.ceil(L / 0.2)));
  const even = Array.from({ length: N + 1 }, (_, k) => pointAt(raw, rc, (L * k) / N));
  const w = Math.max(1, Math.round((1 / L) * N));
  return even.map((_, k) => {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let i = Math.max(0, k - w); i <= Math.min(N, k + w); i++) (sx += even[i][0]), (sy += even[i][1]), c++;
    return [sx / c, sy / c] as Vec2;
  });
}

/** The two rails of a part (null: the part keeps a counter and is sewn the old way). */
function columnOf(g: Region, cutLines: Line[], directions: Line[]): Rails | null {
  if (g.holes.length) return null;
  const o = new Outline(pts(g.outer));
  if (o.L < 1e-6) return null;
  const [a0, b0] = columnRails(o, cutLines.length ? cutRuns(o, cutLines) : []);
  if (a0.length < 2 || b0.length < 2) return null;
  // a first pairing by rung length gives the middle line; folds are closed along it
  const first = pairRails(a0, b0, [], null).pairs;
  const mids = middleLine(a0, b0, first);
  const inPart = (q: Vec2) => insideRegion(g, q);
  // slivers only: folds no deeper than a quarter of the column's width (at most 1 mm)
  const c0 = cumulative(a0);
  const c1 = cumulative(b0);
  const ws = first.map(([x, y]) => len(sub(pointAt(a0, c0, x), pointAt(b0, c1, y)))).sort((x, y) => x - y);
  const deepest = Math.max(0.2, Math.min(1, 0.25 * ws[Math.floor(ws.length / 2)]));
  const a = unfold(a0, mids, inPart, deepest);
  const b = unfold(b0, mids, inPart, deepest);
  const ca = cumulative(a);
  const cb = cumulative(b);
  // the middle line again on the rails without folds, then the rungs across it
  const { pairs, forced } = pairRails(a, b, directions, middleLine(a, b, pairRails(a, b, [], null).pairs));
  const isForced = (x: number, y: number) => forced.some(([p, q]) => p === x && q === y);
  // a rung that would touch the one before (where a fold was closed) is left out
  const A: Vec2[] = [];
  const B: Vec2[] = [];
  const keep: boolean[] = [];
  pairs.forEach(([x, y], k) => {
    const p = pointAt(a, ca, x);
    const q = pointAt(b, cb, y);
    const n = A.length;
    const must = isForced(x, y);
    if (n && !must && k < pairs.length - 1 && segmentsCross(A[n - 1], B[n - 1], p, q)) return;
    A.push(p);
    B.push(q);
    keep.push(must);
  });
  return thin(A, B, keep);
}

const path = (p: Vec2[]): SubPath => ({ closed: false, nodes: p.map((q) => ({ p: q })) });

// ---------------------------------------------------------------------------
// The command

/** What m.split.apply does, with what the tool needs to tell the user. Null: nothing to split. */
export function planSplit(doc: StitchDocument, params: SplitParams): SplitPlan | null {
  const o = doc.objects.find((x) => x.id === params.id);
  if (!o || o.text) return null;
  let parts = regionsOf(o);
  if (!parts.length) return null;
  const overlap = overlapFor(doc);
  for (const cut of params.cuts ?? []) parts = cutParts(parts, cut, overlap);
  const dirs: Line[][] = parts.map(() => []);
  for (const l of params.directions ?? []) {
    if (!(len(sub(l[1], l[0])) > 1e-9)) continue;
    const k = partOfLine(parts, l);
    if (k >= 0) dirs[k].push(l);
  }
  // the cut lines as the parts' outlines hold them: drawn, and moved half the overlap each way
  const cutLines: Line[] = (params.cuts ?? []).flatMap((c) => {
    const n = unit([-(c[1][1] - c[0][1]), c[1][0] - c[0][0]]);
    return [-1, 0, 1].map((k) => [add(c[0], mul(n, (k * overlap) / 2)), add(c[1], mul(n, (k * overlap) / 2))] as Line);
  });
  const auto: number[] = [];
  const notOneColumn: number[] = [];
  const base = { ...defaultStitch("satin"), ...newObjectDefaults(doc).satin, multi: false, guides: undefined, reverseRails: "none" } as StitchParams & SatinParams;
  const group = parts.length > 1 ? uid("g") : undefined;
  const made: DesignObject[] = [];
  parts.forEach((g, k) => {
    const ls = dirs[k];
    if (!ls.length) auto.push(k);
    let rails = columnOf(g, cutLines, ls);
    if (!rails) {
      // a part that still has a counter: slices along its direction, as before
      const r = railsOf(g, ls.length ? sub(ls[0][1], ls[0][0]) : autoDirection(g));
      if (!r) return;
      if (!r.oneColumn) notOneColumn.push(k);
      rails = r.rails;
    }
    made.push({
      id: uid(),
      name: parts.length > 1 ? `${o.name} ${k + 1}` : o.name,
      thread: o.thread,
      visible: o.visible,
      locked: false,
      paths: [path(rails[0]), path(rails[1])],
      stitch: { ...base },
      trimAfter: false,
      stopAfter: false,
      ...(group ? { group } : o.group ? { group: o.group } : {}),
    });
  });
  if (!made.length) return null;
  const out = applyPlan(doc, { replace: { [o.id]: made }, select: made.map((m) => m.id), summary: "" });
  return { doc: out, parts: made.length, auto, notOneColumn, overlap, made: made.map((m) => m.id) };
}

/** m.split.apply: the shape replaced by its satins (one undo step through runCommand). */
export function applySplit(doc: StitchDocument, params: SplitParams): StitchDocument {
  return planSplit(doc, params)?.doc ?? doc;
}
