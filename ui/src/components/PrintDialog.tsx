// Print / PDF (Ink/Stitch "Print PDF"): client and operator views of the
// design with the job's details, per-colour estimates and notes, previewed
// page by page and printed from an iframe — "Save as PDF" in the system print
// dialog makes the PDF. Layout, branding and time factors are kept as defaults.

import { FileImage, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { blockPlan, renderPicture } from "../lib/planImage";
import { fabricInfo, threadWeightInfo } from "../lib/materials";
import { openFile } from "../lib/platform";
import { blockStats, duration, jobSeconds, PRINT_DEFAULTS, sheetHtml, type PrintSettings, type PrintView } from "../lib/printSheet";
import { useStore } from "../store";
import { Dialog, Num, Row, Section, Toggle } from "./ui";
import "../output.css";
import { safeSetItem } from "../lib/storage";
import { t, tn } from "../nova/i18n/filum";

const KEY = "filum.print";
const VIEWS = (): [PrintView, string, string][] => [
  ["clientOverview", t("filum.finestre.client_overview"), t("filum.finestre.the_design_its_colours_and")],
  ["clientDetailed", t("filum.finestre.client_detailed_view"), t("filum.finestre.a_page_per_colour")],
  ["operatorOverview", t("filum.finestre.operator_overview"), t("filum.finestre.job_details_estimated_time_fabric")],
  ["operatorDetailed", t("filum.finestre.operator_detailed_view"), t("filum.finestre.every_colour_block_with_thread")],
  ["pattern", t("filum.finestre.full_page_pattern"), t("filum.finestre.the_design_as_large_as")],
  ["info", t("filum.finestre.information_sheet"), t("filum.finestre.a_page_of_your_own")],
];

function loadSettings(): PrintSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...PRINT_DEFAULTS, ...v, views: { ...PRINT_DEFAULTS.views, ...(v.views ?? {}) } };
  } catch {
    return PRINT_DEFAULTS;
  }
}

/** Keep everything but the machine speed and time factors, which come from the design's machine. */
function saveSettings(s: PrintSettings) {
  const { spm: _a, timeTrim: _b, timeColorChange: _c, ...rest } = s;
  void _a;
  void _b;
  void _c;
  try {
    safeSetItem(KEY, JSON.stringify(rest));
  } catch {
    /* a large logo may not fit */
  }
}

export function PrintDialog({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const fabricColor = useStore((s) => s.fabricColor);
  const [s, setS] = useState<PrintSettings>(() => ({
    ...loadSettings(),
    spm: doc.machine.spm,
    timeTrim: doc.machine.trimSeconds,
    timeColorChange: doc.machine.colorChangeSeconds,
  }));
  const machine = (p: Partial<typeof doc.machine>) => useStore.getState().commit((d) => ({ ...d, machine: { ...d.machine, ...p } }));
  const [title, setTitle] = useState(doc.name || "");
  const [client, setClient] = useState("");
  const [po, setPo] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const set = (p: Partial<PrintSettings>) =>
    setS((x) => {
      const n = { ...x, ...p };
      saveSettings(n);
      return n;
    });

  const blocks = useMemo(() => (plan ? blockStats(plan) : []), [plan]);
  // pictures: the whole design and every colour block on its own
  const pictures = useMemo(() => {
    if (!plan || !plan.flags.length) return null;
    const opts = { kind: s.realistic ? ("realistic" as const) : ("simple" as const), lineWidth: 0.3, background: "transparent" as const, fabricColor, threadWeight: doc.options?.threadWeight, maxSide: 1800 };
    const url = (p: typeof plan, dpi: number) => renderPicture(p, { ...opts, dpi }).toDataURL("image/png");
    const big = Math.max(plan.stats.width, plan.stats.height, 1);
    return {
      overview: url(plan, Math.min(300, (1600 / big) * 25.4)),
      blocks: plan.threads.map((_, i) => url(blockPlan(plan, i), Math.min(200, (700 / big) * 25.4))),
    };
  }, [plan, s.realistic, fabricColor, doc.options?.threadWeight]);

  const html = useMemo(() => {
    if (!plan || !pictures) return "";
    const fabric = fabricInfo(doc.fabric);
    const weight = threadWeightInfo(doc.options?.threadWeight);
    return sheetHtml(
      {
        name: doc.name,
        width: plan.stats.width,
        height: plan.stats.height,
        blocks,
        threadM: plan.stats.threadM,
        bobbinM: plan.stats.bobbinM,
        handTrims: plan.uncut?.count,
        overview: pictures.overview,
        blockPictures: pictures.blocks,
        materials: [
          [t("filum.finestre.hoop"), doc.hoop.name],
          [t("filum.finestre.fabric"), fabric.label],
          [t("filum.finestre.backing"), fabric.backing],
          ["Topping", fabric.topping],
          [t("filum.finestre.thread"), t("filum.finestre.thread_no", { n: weight.weight })],
          [t("filum.finestre.needle"), fabric.needle + (weight.weight !== 40 ? t("filum.finestre.needle_for_thread", { needle: weight.needle }) : "")],
        ],
      },
      { title, client, purchaseOrder: po, notes, date: new Date() },
      s,
    );
  }, [plan, pictures, blocks, doc.name, doc.fabric, doc.hoop.name, doc.options?.threadWeight, title, client, po, notes, s]);

  // the preview: pages zoomed to the box width, the frame as tall as its pages
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const fit = () => {
      const d = f.contentDocument;
      if (!d?.body || !box.current) return;
      const pagePx = ((s.paper === "letter" ? 215.9 : 210) / 25.4) * 96;
      const zoom = Math.min(1, (box.current.clientWidth - 32) / pagePx);
      d.documentElement.style.setProperty("--zoom", String(zoom));
      f.style.height = `${Math.ceil(d.documentElement.scrollHeight) + 4}px`;
    };
    f.onload = fit;
    f.srcdoc = html;
  }, [html, s.paper]);

  const print = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };
  const pickLogo = async () => {
    const f = await openFile([{ name: t("filum.finestre.pictures"), extensions: ["png", "jpg", "jpeg", "svg", "webp", "gif"] }]);
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    const type = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    const url = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(new Blob([f.bytes as BlobPart], { type }));
    });
    set({ logo: url });
  };
  if (!plan) return null;
  const pages = VIEWS().filter(([v]) => s.views[v]).length;

  return (
    <Dialog
      live
      xwide
      title={t("filum.finestre.print_title", { name: doc.name || t("filum.finestre.design") })}
      onClose={onClose}
      footer={
        <>
          <span className="stat">
            {tn("filum.finestre.n_colour_blocks", blocks.length)} · {duration(jobSeconds(blocks, s))}{t("filum.finestre.at")}{s.spm}{t("filum.finestre.spm")}
          </span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.finestre.close")}
          </button>
          <button className="btn primary" disabled={!pages || !html} onClick={print} title={t("filum.finestre.opens_the_print_dialog_choose")}>
            <Printer size={14} />{t("filum.finestre.print_save_as_pdf")}
          </button>
        </>
      }
    >
      <div className="pr">
        <div className="pr-side">
          <Section title={t("filum.finestre.layouts")}>
            {VIEWS().map(([v, l, hint]) => (
              <label key={v} className="check" title={hint}>
                <input type="checkbox" checked={s.views[v]} onChange={(e) => set({ views: { ...s.views, [v]: e.target.checked } })} />
                {l}
              </label>
            ))}
            <Row label={t("filum.finestre.paper")}>
              <div className="seg">
                <button className={s.paper === "a4" ? "on" : ""} onClick={() => set({ paper: "a4" })}>
                  A4
                </button>
                <button className={s.paper === "letter" ? "on" : ""} onClick={() => set({ paper: "letter" })}>
                  {t("filum.finestre.letter")}
                </button>
              </div>
            </Row>
            <Row label={t("filum.finestre.pictures")} title={t("filum.finestre.realistic_as_sewn_stitches_every")}>
              <div className="seg">
                <button className={s.realistic ? "on" : ""} onClick={() => set({ realistic: true })}>
                  {t("filum.finestre.realistic")}
                </button>
                <button className={!s.realistic ? "on" : ""} onClick={() => set({ realistic: false })}>
                  {t("filum.finestre.stitches")}
                </button>
              </div>
            </Row>
            {s.views.operatorDetailed && (
              <Row label={t("filum.finestre.thumbnails")} title={t("filum.finestre.size_of_the_colour_pictures")}>
                <Num value={s.thumbnail} unit="mm" step={5} min={10} max={110} digits={0} onChange={(v) => set({ thumbnail: v })} />
              </Row>
            )}
          </Section>
          <Section title={t("filum.finestre.job")}>
            <label className="pr-field">
              <span className="stat">{t("filum.finestre.title")}</span>
              <input className="input" value={title} placeholder={doc.name || t("filum.finestre.job_title")} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="pr-field">
              <span className="stat">{t("filum.finestre.client")}</span>
              <input className="input" value={client} placeholder={t("filum.finestre.client_name")} onChange={(e) => setClient(e.target.value)} />
            </label>
            <label className="pr-field">
              <span className="stat">{t("filum.finestre.purchase_order")}</span>
              <input className="input" value={po} onChange={(e) => setPo(e.target.value)} />
            </label>
          </Section>
          {s.views.operatorDetailed && (
            <Section title={t("filum.finestre.operator_notes")} defaultOpen={false}>
              {blocks.map((b, i) => (
                <label key={i} className="pr-note">
                  <i style={{ background: b.thread.color }} />
                  <input
                    className="input"
                    value={notes[i] ?? ""}
                    placeholder={`${i + 1}. ${b.thread.name}`}
                    onChange={(e) => setNotes((n) => Object.assign([...n], { [i]: e.target.value }))}
                  />
                </label>
              ))}
            </Section>
          )}
          <Section title={t("filum.finestre.estimated_time")} defaultOpen={false}>
            {/* the design's own values (Design ▸ Time estimates): one place, saved with the design */}
            <Row label={t("filum.finestre.speed")} title={t("filum.finestre.stitches_per_minute_saved_with")}>
              <Num value={s.spm} unit={t("filum.finestre.spm_2")} step={50} min={100} max={2000} digits={0} onChange={(v) => (set({ spm: v }), machine({ spm: v }))} />
            </Row>
            <Row label={t("filum.finestre.trim_time")} title={t("filum.finestre.seconds_for_every_trim_saved")}>
              <Num value={s.timeTrim} unit={t("filum.finestre.unit_seconds")} step={1} min={0} max={120} digits={0} onChange={(v) => (set({ timeTrim: v }), machine({ trimSeconds: v }))} />
            </Row>
            <Row label={t("filum.finestre.colour_change")} title={t("filum.finestre.seconds_for_every_colour_change")}>
              <Num value={s.timeColorChange} unit={t("filum.finestre.unit_seconds")} step={1} min={0} max={600} digits={0} onChange={(v) => (set({ timeColorChange: v }), machine({ colorChangeSeconds: v }))} />
            </Row>
            <Row label={t("filum.finestre.add_to_total")} title={t("filum.finestre.preparing_the_machine_thread_breaks")}>
              <Num value={s.timeAdditional} unit={t("filum.finestre.unit_seconds")} step={30} min={0} max={36000} digits={0} onChange={(v) => set({ timeAdditional: v })} />
            </Row>
            <Row label={t("filum.finestre.client_pages")} title={t("filum.finestre.show_the_estimated_time_on")}>
              <Toggle on={s.clientTimes} onChange={(v) => set({ clientTimes: v })} />
            </Row>
          </Section>
          <Section title={t("filum.finestre.branding")} defaultOpen={false}>
            <Row label="Logo">
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {s.logo && <img src={s.logo} alt="" style={{ maxHeight: 24, maxWidth: 70 }} />}
                <button className="btn sm" onClick={pickLogo}>
                  <FileImage size={12} />{t("filum.finestre.choose")}
                </button>
                {s.logo && (
                  <button className="btn sm ghost" onClick={() => set({ logo: "" })}>
                    {t("filum.finestre.remove")}
                  </button>
                )}
              </span>
            </Row>
            <Row label={t("filum.finestre.footer")}>
              <Toggle on={s.showFooter} onChange={(v) => set({ showFooter: v })} />
            </Row>
            {s.showFooter && <input className="input" value={s.footer} onChange={(e) => set({ footer: e.target.value })} placeholder={t("filum.finestre.contact_website")} />}
            {s.views.info && (
              <>
                <span className="stat">{t("filum.finestre.information_sheet")}</span>
                <textarea className="input" value={s.infoText} onChange={(e) => set({ infoText: e.target.value })} placeholder={t("filum.finestre.care_instructions_terms_contact")} />
              </>
            )}
          </Section>
        </div>
        <div className="pr-preview" ref={box}>
          <iframe ref={frame} title={t("filum.finestre.print_preview")} />
        </div>
      </div>
    </Dialog>
  );
}
