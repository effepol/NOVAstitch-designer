// The work sheet's pages (module l), as a list of things to draw in mm from the
// top-left corner of an A4 page: pure, so the tests read it; pdf.ts draws it
// with pdf-lib. Style of the NOVAstitch manuals: monospace black (Courier),
// titles in red #CC1219, the dotted logo.
//
// Page 1: logo and name, the job (file, size, counts, fabric, stabiliser,
// topping, needle, hoop), the boxes of the special work, the preview (1:1 when
// it fits, else reduced with its scale written), the colour table. A second
// page only for the rest of the colour table. No estimated time.

import type { PlanData } from "../../types";
import { getLanguage, t } from "../core/i18n";
import "./texts";
import { decimal, metres, whole } from "./format";
import type { Needle, SheetData } from "./sheetData";

export const A4 = { w: 210, h: 297 };
export const MARGIN = 15;
export const WIDTH = A4.w - 2 * MARGIN;
export const RED = "#CC1219";
export const GREY = "#777777";
/** Courier: every glyph is 0.6 em wide. */
export const charMm = (pt: number) => 0.6 * pt * (25.4 / 72);

export type Item =
  | { k: "text"; x: number; y: number; size: number; text: string; bold?: boolean; color?: string; align?: "left" | "right" }
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number }
  | { k: "logo"; x: number; y: number; size: number }
  /** The stitches drawn at `scale` (1 = 1:1), the point (x0, y0) of the design at (x, y). */
  | { k: "stitches"; x: number; y: number; scale: number; x0: number; y0: number };

export interface SheetLayout {
  pages: Item[][];
  /** 1 = 1:1. */
  previewScale: number;
  /** Colour table rows on each page. */
  rowsPerPage: number[];
}

/** Text cut to `chars` characters, with … when cut. */
export const fit = (s: string, chars: number) => (s.length <= chars ? s : `${s.slice(0, Math.max(0, chars - 1))}…`);

/** Words wrapped to lines of at most `chars` characters. */
export function wrap(s: string, chars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= chars) cur += ` ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.flatMap((l) => (l.length > chars ? (l.match(new RegExp(`.{1,${chars}}`, "g")) ?? [l]) : [l]));
}

/** Bounds of the needle penetrations (mm). */
export function stitchBounds(plan: PlanData | null): { x: number; y: number; w: number; h: number } | null {
  if (!plan) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < plan.flags.length; i++) {
    if (plan.flags[i] & 31) continue;
    const x = plan.coords[2 * i];
    const y = plan.coords[2 * i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x0 <= x1 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export const needleText = (n: Needle) => (n.size === null ? t("l.needle.special") : n.size);

const ROW = 5.2;
const HEAD = 6.5;
const TOTAL = 6.5;
const TABLE_PT = 7.5;
const MIN_PREVIEW = 60;
/** Columns: key, width (mm), alignment. */
const COLS: [string, number, "left" | "right"][] = [
  ["n", 9, "right"],
  ["color", 59, "left"],
  ["stitches", 20, "right"],
  ["trims", 14, "right"],
  ["weight", 12, "right"],
  ["needle", 28, "left"],
  ["top", 19, "right"],
  ["bobbin", 19, "right"],
];

export function layoutSheet(data: SheetData, plan: PlanData | null): SheetLayout {
  const lang = getLanguage();
  const pages: Item[][] = [[]];
  let page = pages[0];
  const text = (x: number, y: number, size: number, s: string, o: Partial<Extract<Item, { k: "text" }>> = {}) => page.push({ k: "text", x, y, size, text: s, ...o });
  const rule = (y: number, color = RED, h = 0.5) => page.push({ k: "rect", x: MARGIN, y, w: WIDTH, h, fill: color });
  const bottom = A4.h - MARGIN - 6;

  // ---- header: the logo, the program's name, the sheet's title
  let y = MARGIN;
  page.push({ k: "logo", x: MARGIN, y, size: 14 });
  text(MARGIN + 18, y + 6, 16, "NOVAstitch Designer", { bold: true, color: RED });
  text(MARGIN + 18, y + 12, 10, t("l.title"), { bold: true });
  y += 17;
  rule(y);
  y += 5;

  // ---- the job: two columns of label and value
  const INFO_PT = 8.5;
  const lineH = 4.4;
  const colChars = Math.floor((WIDTH / 2 - 2) / charMm(INFO_PT));
  const pair = (x: number, yy: number, label: string, value: string) => {
    const l = `${label}:`;
    text(x, yy, INFO_PT, l, { bold: true });
    const at = Math.max(l.length + 1, 15);
    text(x + at * charMm(INFO_PT), yy, INFO_PT, fit(value, colChars - at));
  };
  const p = data.preset;
  const left: [string, string][] = [
    [t("l.file"), data.fileName],
    [t("l.size"), `${decimal(data.width, 1, lang)} × ${decimal(data.height, 1, lang)} mm`],
    [t("l.stitches"), whole(data.stitches, lang)],
    [t("l.jumps"), whole(data.jumps, lang)],
    [t("l.trims"), whole(data.trims, lang)],
    [t("l.colorChanges"), whole(data.colorChanges, lang)],
  ];
  const point = t(`l.point.${data.needlePoint}`);
  const right: [string, string][] = [
    [t("l.fabric"), p ? p.name[lang] : t("l.noPreset", { fabric: t(`l.fabric.${data.fabric}`) })],
    [t("l.stabilizer"), p ? `${t(`l.stabilizer.${p.stabilizer.type}`)}, ${t(`l.weight.${p.stabilizer.weight}`)}` : "—"],
    [t("l.topping"), p ? t(`l.topping.${p.topping}`) : "—"],
    [t("l.needle"), `${needleText(data.jobNeedle)}, ${point}`],
    [t("l.hoop"), `${data.hoop.name} (${decimal(data.hoop.width, 0, lang)} × ${decimal(data.hoop.height, 0, lang)} mm)`],
  ];
  left.forEach(([l, v], i) => pair(MARGIN, y + i * lineH, l, v));
  right.forEach(([l, v], i) => pair(MARGIN + WIDTH / 2 + 2, y + i * lineH, l, v));
  let lines = Math.max(left.length, right.length);
  if (data.jobNeedle.note) {
    text(MARGIN + WIDTH / 2 + 2, y + right.length * lineH, INFO_PT, fit(t(`l.needle.note.${data.jobNeedle.note}`), colChars));
    lines = Math.max(lines, right.length + 1);
  }
  y += lines * lineH;

  // ---- the boxes of the special work: red frame, title in red, the notes
  for (const b of data.boxes) {
    const notePt = 8;
    const note = b === "cap" || b === "layered3d" ? [] : wrap(t(`l.box.${b}.note`), Math.floor((WIDTH - 6) / charMm(notePt)));
    const h = (note.length ? 9 : 7.5) + note.length * 3.8;
    page.push({ k: "rect", x: MARGIN, y, w: WIDTH, h, stroke: RED, lw: 1.2 });
    text(MARGIN + 3, y + 5.2, 10, t(`l.box.${b}`), { bold: true, color: RED });
    note.forEach((l, i) => text(MARGIN + 3, y + 9.2 + i * 3.8, notePt, l));
    y += h + 2;
  }
  y += 2;

  // ---- preview and table: how much room the table takes decides the preview's size
  const n = data.rows.length;
  const tableH = (rows: number) => HEAD + rows * ROW + TOTAL;
  const caption = 5;
  const bounds = stitchBounds(plan);
  const room = bottom - y - caption - 4;
  const fitScale = (h: number) => (bounds ? Math.min(1, WIDTH / Math.max(bounds.w, 1e-6), h / Math.max(bounds.h, 1e-6)) : 1);
  let previewH = room - tableH(n);
  let firstRows = n;
  if (bounds && previewH < Math.min(MIN_PREVIEW, bounds.h)) {
    // the table goes on: the preview keeps a useful size, the rest of the rows on page 2
    previewH = Math.min(MIN_PREVIEW, bounds.h);
    firstRows = Math.max(0, Math.floor((room - previewH - HEAD - TOTAL) / ROW));
  }
  const scale = fitScale(Math.max(previewH, 1));
  if (bounds) {
    const w = bounds.w * scale;
    const h = bounds.h * scale;
    page.push({ k: "stitches", x: MARGIN + (WIDTH - w) / 2, y, scale, x0: bounds.x, y0: bounds.y });
    y += h + 1.5;
    const cap = scale >= 1 ? t("l.preview.full") : t("l.preview.reduced", { ratio: decimal(1 / scale, 2, lang), pct: Math.round(scale * 100) });
    text(MARGIN + WIDTH / 2 - (cap.length * charMm(8)) / 2, y + 3, 8, cap, { color: scale >= 1 ? undefined : RED, bold: scale < 1 });
    y += caption + 3;
  } else {
    text(MARGIN, y + 3, 8, t("l.preview.none"), { color: GREY });
    y += caption + 3;
  }

  // ---- the colour table: one row per colour change, totals at the end
  const rowsPerPage: number[] = [];
  const tableHeader = () => {
    page.push({ k: "rect", x: MARGIN, y, w: WIDTH, h: HEAD, fill: "#EEEEEE" });
    let x = MARGIN;
    for (const [key, w, align] of COLS) {
      text(align === "right" ? x + w - 1.5 : x + 1.5, y + 4.4, TABLE_PT, t(`l.col.${key}`), { bold: true, color: RED, align });
      x += w;
    }
    y += HEAD;
  };
  const cell = (x: number, w: number, align: "left" | "right", s: string, o: Partial<Extract<Item, { k: "text" }>> = {}) =>
    text(align === "right" ? x + w - 1.5 : x + 1.5, y + 3.7, TABLE_PT, fit(s, Math.floor((w - 3) / charMm(TABLE_PT))), { align, ...o });
  let onPage = 0;
  let room1 = firstRows;
  const nextPage = () => {
    // the rest of the table on the next page
    rowsPerPage.push(onPage);
    page = [];
    pages.push(page);
    y = MARGIN;
    page.push({ k: "logo", x: MARGIN, y, size: 8 });
    text(MARGIN + 11, y + 5.5, 9, fit(`${t("l.title")} · ${data.fileName} · ${t("l.table.continued")}`, Math.floor((WIDTH - 11) / charMm(9))), { bold: true, color: RED });
    y += 10;
    rule(y - 1.5);
    onPage = 0;
    room1 = Math.floor((bottom - y - HEAD - TOTAL) / ROW);
  };
  if (n && !firstRows) nextPage();
  tableHeader();
  for (const r of data.rows) {
    if (onPage >= room1) {
      nextPage();
      tableHeader();
    }
    let x = MARGIN;
    const th = r.thread;
    const label = [th.brand, th.code, th.name].filter(Boolean).join(" ");
    for (const [key, w, align] of COLS) {
      if (key === "n") cell(x, w, align, String(r.n));
      else if (key === "color") {
        page.push({ k: "rect", x: x + 1.5, y: y + 0.9, w: 3.4, h: 3.4, fill: th.color, stroke: "#000000", lw: 0.3 });
        text(x + 6.5, y + 3.7, TABLE_PT, fit(label || th.color, Math.floor((w - 8) / charMm(TABLE_PT))));
      } else if (key === "stitches") cell(x, w, align, whole(r.stitches, lang));
      else if (key === "trims") cell(x, w, align, whole(r.trims, lang));
      else if (key === "weight") cell(x, w, align, String(r.weight));
      else if (key === "needle") cell(x, w, align, (r.needleDiffers ? "! " : "") + needleText(r.needle), r.needleDiffers ? { bold: true, color: RED } : {});
      else if (key === "top") cell(x, w, align, metres(r.topM, lang));
      else if (key === "bobbin") cell(x, w, align, metres(r.bobbinM, lang));
      x += w;
    }
    y += ROW;
    page.push({ k: "rect", x: MARGIN, y: y - 0.1, w: WIDTH, h: 0.2, fill: "#CCCCCC" });
    onPage++;
  }
  rowsPerPage.push(onPage);
  // totals
  rule(y, "#000000", 0.4);
  let x = MARGIN;
  for (const [key, w, align] of COLS) {
    const v =
      key === "color" ? t("l.total") : key === "stitches" ? whole(data.totals.stitches, lang) : key === "trims" ? whole(data.totals.trims, lang) : key === "top" ? metres(data.totals.topM, lang) : key === "bobbin" ? metres(data.totals.bobbinM, lang) : "";
    if (v) text(align === "right" ? x + w - 1.5 : x + 1.5, y + 4.4, TABLE_PT, v, { bold: true, align });
    x += w;
  }

  // ---- page numbers
  pages.forEach((items, i) => items.push({ k: "text", x: A4.w - MARGIN, y: A4.h - MARGIN + 2, size: 7, text: t("l.page", { n: i + 1, of: pages.length }), color: GREY, align: "right" }));
  return { pages, previewScale: scale, rowsPerPage };
}
