// Module f — Library (contract, «f — Libreria e modifica»): base shapes for
// patches, in ui/src/nova/library/ (SVG or .nsd, each with its licence in
// manifest.json). f.library.insert({itemId, size, cornerRadius?, borderWidth?})
// puts one in the middle of the hoop: the shape as a fill, and with a border
// width a satin along its outline; the two move together (one group).

import type { DesignObject, PathNode, StitchDocument, SubPath, Thread, Vec2 } from "../../types";
import { boundsOfPoints, defaultFill, defaultSatin, ellipsePath, flatten, rectPath, transformPaths, uid, type Mat } from "../../lib/geometry";
import { mergeThreads, remapThreads } from "../../lib/copies";
import { getLanguage, t } from "../core/i18n";
import "./texts";

export interface LibraryItem {
  id: string;
  kind: "svg" | "nsd";
  /** Path inside the library folder. */
  file: string;
  name: { it: string; en: string };
  /** The shape takes rounded corners (rectangles). */
  cornerRadius?: boolean;
  /** SPDX identifier; an item without one is left out. */
  license: string;
  author: string;
}

export interface LibraryManifest {
  schemaVersion: number;
  items: LibraryItem[];
}

export interface InsertParams {
  itemId: string;
  /** Width and height of the shape (mm). */
  size: Vec2;
  /** Corner radius (mm), for items that take it. */
  cornerRadius?: number;
  /** Width of the satin border (mm); 0 or absent: no border. */
  borderWidth?: number;
}

let items: LibraryItem[] = [];
let files: Record<string, string> = {};

const licensed = (i: LibraryItem) => typeof i?.license === "string" && /^[A-Za-z0-9.+-]+$/.test(i.license) && !!i.author;

/** The library the command reads (static data: the files shipped with the app). Items without a licence are left out. */
export function setLibrary(manifest: LibraryManifest, contents: Record<string, string>): void {
  items = (manifest?.items ?? []).filter((i) => licensed(i) && (i.kind === "svg" || i.kind === "nsd") && typeof contents[i.file] === "string");
  files = contents;
}

export const libraryItems = (): LibraryItem[] => items;

// ---- SVG: one path / rect / circle / ellipse (the subset the library's files use) ----

const num = (s: string | undefined, d = 0) => (s === undefined || s === "" ? d : Number(s));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`))?.[1];

/** A path's d (M L H V C Z, absolute or relative) as sub-paths with bezier handles. */
export function parsePathData(d: string): SubPath[] {
  const tokens = d.match(/[MmLlHhVvCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: SubPath[] = [];
  let cur: PathNode[] = [];
  let pos: Vec2 = [0, 0];
  let start: Vec2 = [0, 0];
  let cmd = "";
  let i = 0;
  const next = () => Number(tokens[i++]);
  const flush = (closed: boolean) => {
    if (closed && cur.length > 1) {
      const [a, z] = [cur[0], cur[cur.length - 1]];
      // the closing node sits on the first one: one node, with both handles
      if (Math.abs(a.p[0] - z.p[0]) < 1e-9 && Math.abs(a.p[1] - z.p[1]) < 1e-9) {
        cur.pop();
        cur[0] = { ...a, ...(z.i ? { i: z.i } : {}) };
      }
    }
    if (cur.length) out.push({ closed, nodes: cur });
    cur = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const at = (x: number, y: number): Vec2 => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case "M":
        flush(false);
        pos = at(next(), next());
        start = pos;
        cur.push({ p: pos });
        cmd = rel ? "l" : "L";
        break;
      case "L":
        pos = at(next(), next());
        cur.push({ p: pos });
        break;
      case "H":
        pos = [rel ? pos[0] + next() : next(), pos[1]];
        cur.push({ p: pos });
        break;
      case "V":
        pos = [pos[0], rel ? pos[1] + next() : next()];
        cur.push({ p: pos });
        break;
      case "C": {
        const c1 = at(next(), next());
        const c2 = at(next(), next());
        const p = at(next(), next());
        if (cur.length) cur[cur.length - 1] = { ...cur[cur.length - 1], o: c1 };
        cur.push({ p, i: c2 });
        pos = p;
        break;
      }
      case "Z":
        flush(true);
        pos = start;
        break;
      default:
        throw new Error(`SVG path: «${cmd}» is not supported`);
    }
  }
  flush(false);
  return out;
}

/** The shape of a library SVG: its first path, rect, circle or ellipse (in the SVG's units). */
export function parseSvgShape(svg: string): SubPath[] | null {
  const tag = svg.match(/<(path|rect|circle|ellipse)\b[^>]*>/)?.[0];
  if (!tag) return null;
  const kind = tag.slice(1).split(/\s/)[0];
  if (kind === "path") return parsePathData(attr(tag, "d") ?? "");
  if (kind === "rect") return [rectPath(num(attr(tag, "x")), num(attr(tag, "y")), num(attr(tag, "width")), num(attr(tag, "height")))];
  if (kind === "circle") {
    const r = num(attr(tag, "r"));
    return [ellipsePath(num(attr(tag, "cx")), num(attr(tag, "cy")), r, r)];
  }
  return [ellipsePath(num(attr(tag, "cx")), num(attr(tag, "cy")), num(attr(tag, "rx")), num(attr(tag, "ry")))];
}

/** A rectangle with rounded corners (radius in mm, at most half the short side). */
export function roundedRect(x: number, y: number, w: number, h: number, radius: number): SubPath {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r <= 0) return rectPath(x, y, w, h);
  const k = 0.5522847498 * r;
  const n = (p: Vec2, i?: Vec2, o?: Vec2): PathNode => ({ p, ...(i ? { i } : {}), ...(o ? { o } : {}) });
  return {
    closed: true,
    nodes: [
      n([x + r, y], [x + r - k, y]),
      n([x + w - r, y], undefined, [x + w - r + k, y]),
      n([x + w, y + r], [x + w, y + r - k]),
      n([x + w, y + h - r], undefined, [x + w, y + h - r + k]),
      n([x + w - r, y + h], [x + w - r + k, y + h]),
      n([x + r, y + h], undefined, [x + r - k, y + h]),
      n([x, y + h - r], [x, y + h - r + k]),
      n([x, y + r], undefined, [x, y + r - k]),
    ],
  };
}

const boxOfPaths = (paths: SubPath[]) => boundsOfPoints(paths.flatMap((p) => flatten(p, 16)));

/** Paths stretched to w × h and centred on (cx, cy). */
function fit(paths: SubPath[], w: number, h: number, cx: number, cy: number): SubPath[] | null {
  const b = boxOfPaths(paths);
  if (!b || b.w <= 0 || b.h <= 0) return null;
  const [sx, sy] = [w / b.w, h / b.h];
  const m: Mat = [sx, 0, 0, sy, cx - w / 2 - b.x * sx, cy - h / 2 - b.y * sy];
  return transformPaths(paths, m);
}

const FILL_THREAD: Thread = { id: "f.lib.fill", name: "Patch", color: "#1f5fa8", brand: "", code: "" };
const BORDER_THREAD: Thread = { id: "f.lib.border", name: "Patch border", color: "#d4a017", brand: "", code: "" };

const objectOf = (id: string, name: string, thread: string, paths: SubPath[], stitch: DesignObject["stitch"], group: string): DesignObject => ({
  id,
  name,
  thread,
  visible: true,
  locked: false,
  paths,
  stitch,
  trimAfter: false,
  stopAfter: false,
  group,
});

/** f.library.insert: the item in the middle of the hoop; the same document when the request cannot be done. */
export function insertItem(doc: StitchDocument, p: InsertParams): StitchDocument {
  const item = items.find((i) => i.id === p?.itemId);
  const [w, h] = Array.isArray(p?.size) ? p.size : [NaN, NaN];
  const border = p?.borderWidth ?? 0;
  if (!item || !(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h) || !(border >= 0) || !Number.isFinite(border)) return doc;
  const [cx, cy] = [doc.hoop.width / 2, doc.hoop.height / 2];
  const group = uid("g");
  const name = item.name[getLanguage()] ?? item.name.en;

  if (item.kind === "nsd") {
    const src = JSON.parse(files[item.file]) as StitchDocument;
    const box = boxOfPaths(src.objects.flatMap((o) => o.paths));
    if (!box || box.w <= 0 || box.h <= 0) return doc;
    const [sx, sy] = [w / box.w, h / box.h];
    const m: Mat = [sx, 0, 0, sy, cx - w / 2 - box.x * sx, cy - h / 2 - box.y * sy];
    const { add, map } = mergeThreads(doc.threads, src.threads ?? []);
    const objects = src.objects.map((o) => {
      const { clone: _c, ...plain } = o;
      void _c;
      return remapThreads({ ...plain, id: uid(), group, paths: transformPaths(o.paths, m), start: undefined, end: undefined }, (id) => map.get(id) ?? id);
    });
    return { ...doc, threads: [...doc.threads, ...add], objects: [...doc.objects, ...objects], groupNames: { ...doc.groupNames, [group]: name } };
  }

  const shape = item.cornerRadius && p.cornerRadius ? [roundedRect(cx - w / 2, cy - h / 2, w, h, p.cornerRadius)] : fit(parseSvgShape(files[item.file]) ?? [], w, h, cx, cy);
  if (!shape?.length) return doc;
  const wanted = border > 0 ? [FILL_THREAD, BORDER_THREAD] : [FILL_THREAD];
  const { add, map } = mergeThreads(doc.threads, wanted);
  const objects = [objectOf(uid(), name, map.get(FILL_THREAD.id)!, shape, { type: "fill", ...defaultFill() }, group)];
  if (border > 0) objects.push(objectOf(uid(), t("f.library.borderName", { name }), map.get(BORDER_THREAD.id)!, shape, { type: "satin", ...defaultSatin(), width: border }, group));
  return { ...doc, threads: [...doc.threads, ...add], objects: [...doc.objects, ...objects], groupNames: { ...doc.groupNames, [group]: name } };
}
