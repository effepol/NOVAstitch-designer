// The work sheet as PDF bytes (module l): the pages of layout.ts drawn with
// pdf-lib (MIT), straight to a file, without the system's print dialog, the
// same on Windows, macOS and Linux. Courier and Courier-Bold, the PDF's own
// monospace fonts: nothing to embed. The preview is drawn as vector lines,
// so 1:1 is exact on paper.

import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, stroke, setLineWidth, setStrokingRgbColor, setLineCap, LineCapStyle, type PDFFont, type PDFPage, type PDFOperator } from "pdf-lib";
import type { PlanData } from "../../types";
import { A4, layoutSheet, type Item } from "./layout";
import { LOGO_DOTS, LOGO_GRID, LOGO_RADIUS, LOGO_RED } from "./logo";
import type { SheetData } from "./sheetData";

const PT = 72 / 25.4;

const colour = (hex: string) => {
  const v = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16) || 0;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};

/** Text the font can write: characters outside its encoding (WinAnsi) become «?». */
function encodable(font: PDFFont, s: string, cache: Map<string, boolean>): string {
  let out = "";
  for (const ch of s) {
    let ok = cache.get(ch);
    if (ok === undefined) {
      try {
        font.encodeText(ch);
        ok = true;
      } catch {
        ok = false;
      }
      cache.set(ch, ok);
    }
    out += ok ? ch : "?";
  }
  return out;
}

function drawLogo(page: PDFPage, x: number, y: number, size: number) {
  const k = size / LOGO_GRID;
  const top = A4.h - y;
  // the red tile with rounded corners, as an SVG path in mm, y down from the logo's top
  const r = LOGO_RADIUS * k;
  const s = size;
  const path = `M ${r} 0 H ${s - r} A ${r} ${r} 0 0 1 ${s} ${r} V ${s - r} A ${r} ${r} 0 0 1 ${s - r} ${s} H ${r} A ${r} ${r} 0 0 1 0 ${s - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, { x: x * PT, y: top * PT, scale: PT, color: colour(LOGO_RED), borderWidth: 0 });
  for (const [cx, cy, cr] of LOGO_DOTS) page.drawCircle({ x: (x + cx * k) * PT, y: (top - cy * k) * PT, size: cr * k * PT, color: rgb(1, 1, 1) });
}

/** The stitches as lines between consecutive penetrations, one stroke colour per colour block. */
function drawStitches(page: PDFPage, plan: PlanData, it: Extract<Item, { k: "stitches" }>) {
  const ops: PDFOperator[] = [pushGraphicsState(), setLineCap(LineCapStyle.Round), setLineWidth(Math.max(0.15, 0.3 * it.scale * PT))];
  const X = (x: number) => (it.x + (x - it.x0) * it.scale) * PT;
  const Y = (y: number) => (A4.h - (it.y + (y - it.y0) * it.scale)) * PT;
  let block = 0;
  let open = false;
  let last: [number, number] | null = null;
  const setColour = () => {
    const c = colour(plan.threads[block]?.color ?? "#000000");
    ops.push(setStrokingRgbColor(c.red, c.green, c.blue));
  };
  setColour();
  for (let i = 0; i < plan.flags.length; i++) {
    const f = plan.flags[i];
    if (f & 4) {
      if (open) ops.push(stroke());
      open = false;
      last = null;
      block++;
      setColour();
      continue;
    }
    // a trim or a jump: no thread drawn to the next penetration
    if (f & 3) {
      last = null;
      continue;
    }
    if (f & 24) continue;
    const p: [number, number] = [plan.coords[2 * i], plan.coords[2 * i + 1]];
    if (!last) {
      ops.push(moveTo(X(p[0]), Y(p[1])));
      open = true;
    } else ops.push(lineTo(X(p[0]), Y(p[1])));
    last = p;
  }
  if (open) ops.push(stroke());
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
}

/** The PDF of the work sheet, in the program's language. */
export async function sheetPdf(data: SheetData, plan: PlanData | null): Promise<Uint8Array> {
  const layout = layoutSheet(data, plan);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${data.fileName}`);
  pdf.setCreator("NOVAstitch Designer");
  pdf.setProducer("NOVAstitch Designer (pdf-lib)");
  const regular = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);
  const cache = new Map<string, boolean>();
  for (const items of layout.pages) {
    const page = pdf.addPage([A4.w * PT, A4.h * PT]);
    for (const it of items) {
      if (it.k === "text") {
        const font = it.bold ? bold : regular;
        const s = encodable(font, it.text, cache);
        const w = font.widthOfTextAtSize(s, it.size);
        page.drawText(s, { x: it.x * PT - (it.align === "right" ? w : 0), y: (A4.h - it.y) * PT, size: it.size, font, color: colour(it.color ?? "#000000") });
      } else if (it.k === "rect") {
        page.drawRectangle({
          x: it.x * PT,
          y: (A4.h - it.y - it.h) * PT,
          width: it.w * PT,
          height: it.h * PT,
          color: it.fill ? colour(it.fill) : undefined,
          borderColor: it.stroke ? colour(it.stroke) : undefined,
          borderWidth: it.stroke ? (it.lw ?? 0.5) : 0,
        });
      } else if (it.k === "logo") drawLogo(page, it.x, it.y, it.size);
      else if (it.k === "stitches" && plan) drawStitches(page, plan, it);
    }
  }
  return pdf.save();
}
