// Lettering tools in the Lettering properties: batch lettering (many files
// from a list of texts), the font section (sample sheet, font info) and the
// font editor (Ink/Stitch's Edit JSON: metadata, spacing, kerning) with a
// live preview.

import { t, tn } from "../nova/i18n/filum";
import { FileArchive, FileJson, LayoutGrid, PencilRuler, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { engine } from "../engine/client";
import { copyBundledFont, fontLabel, inkFontInfo, loadFont, removeInkFont, saveInkFontInfo, type EmbroideryFont } from "../lib/fonts";
import { batchTexts, FONT_INFO_DEFAULTS, fontJsonText, kerningRows, withFontInfo } from "../lib/letteringTools";
import { enc, saveFile } from "../lib/platform";
import type { TextSpec } from "../lib/text";
import { layoutText } from "../lib/textLayout";
import { batchLettering, insertFontSample, refreshLetterings, selectGroup, updateText } from "../lib/textOps";
import { makeZip } from "../lib/zip";
import { emptyDoc, useStore } from "../store";
import type { DesignObject, FormatInfo, Thread } from "../types";
import { DesignView } from "../canvas/DesignView";
import { Dialog, Num, Row, Section, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";

/** Stitch directions of Ink/Stitch font variants. */
export const VARIANT_LABELS: Record<string, { arrow: string; name: string }> = {
  ltr: { arrow: "→", get name() { return t("filum.pannelli.left_to_right"); } },
  rtl: { arrow: "←", get name() { return t("filum.pannelli.right_to_left"); } },
  ttb: { arrow: "↓", get name() { return t("filum.pannelli.top_to_bottom"); } },
  btt: { arrow: "↑", get name() { return t("filum.pannelli.bottom_to_top"); } },
};

// ---------------------------------------------------------------------------
// Batch lettering

const BATCH_KEY = "filum.batchLettering";
const QUICK_FORMATS = ["pes", "dst", "jef", "exp", "vp3", "hus", "xxx", "svg"];
const SEPARATORS = (): [string, string][] => [
  ["", t("filum.pannelli.new_line")],
  [";", t("filum.pannelli.semicolon")],
  [",", t("filum.pannelli.comma")],
  ["|", t("filum.pannelli.bar")],
];

function loadBatch(): { text: string; separator: string; formats: string[] } {
  try {
    const v = JSON.parse(localStorage.getItem(BATCH_KEY) ?? "{}");
    return { text: v.text ?? "", separator: v.separator ?? "", formats: Array.isArray(v.formats) && v.formats.length ? v.formats : [localStorage.getItem("filum.format") ?? "pes"] };
  } catch {
    return { text: "", separator: "", formats: ["pes"] };
  }
}

/** Batch lettering (Ink/Stitch's Batch Lettering): one file per text, in a ZIP. */
export function BatchSection({ group, spec }: { group: string; spec: TextSpec }) {
  const [state, setState] = useState(loadBatch);
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    engine
      .formats()
      .then((f) => setFormats(f.filter((x) => x.canWrite && x.extension !== "filum" && x.extension !== "json")))
      .catch(() => {});
  }, []);
  const patch = (p: Partial<typeof state>) => {
    const next = { ...state, ...p };
    setState(next);
    safeSetItem(BATCH_KEY, JSON.stringify(next));
  };
  const texts = useMemo(() => batchTexts(state.text, state.separator), [state.text, state.separator]);
  const quick = QUICK_FORMATS.filter((e) => formats.some((f) => f.extension === e));
  const others = formats.filter((f) => !quick.includes(f.extension));
  const toggle = (ext: string) => patch({ formats: state.formats.includes(ext) ? state.formats.filter((f) => f !== ext) : [...state.formats, ext] });
  const run = async () => {
    if (!texts.length || !state.formats.length) return;
    const s = useStore.getState();
    setBusy("0");
    try {
      const { files, failed } = await batchLettering(group, texts, state.formats, (d, n) => setBusy(`${d}/${n}`));
      for (const f of failed.slice(0, 3)) s.toast(t("filum.pannelli.batch_f", { f }), "error");
      if (!files.length) return;
      const name = `${(s.doc.name || "lettering").replace(/[\\/:*?"<>|]+/g, "_")}-batch.zip`;
      const saved = await saveFile(name, makeZip(files), [{ name: "ZIP archive", extensions: ["zip"] }]);
      if (saved) s.toast(tn("filum.pannelli.exported_n_files_to", files.length, { name }), "success");
    } catch (e) {
      s.toast(t("filum.pannelli.batch_lettering_failed_message", { message: (e as Error).message }), "error");
    } finally {
      setBusy(null);
    }
  };
  const total = texts.length * state.formats.length;
  return (
    <Section title={t("filum.pannelli.batch_lettering")} defaultOpen={false}>
      <p className="hint" style={{ paddingTop: 2 }}>
        {t("filum.pannelli.one_file_per_text_names")}
        {spec.path ? t("filum.pannelli.and_path") : ""}{t("filum.pannelli.the_rest_of_the_design")}
      </p>
      <textarea
        className="input"
        style={{ width: "100%", height: 84, fontSize: "var(--fs-md)" }}
        placeholder={state.separator ? t("filum.pannelli.anna_separator_ben_separator__cleo", { separator: state.separator, separator_: state.separator }) : t("filum.pannelli.anna_ben_cleo")}
        value={state.text}
        onChange={(e) => patch({ text: e.target.value })}
      />
      <Row label={t("filum.pannelli.separator")} title={t("filum.pannelli.what_separates_the_texts_with")}>
        <select className="select" style={{ width: "100%" }} value={state.separator} onChange={(e) => patch({ separator: e.target.value })}>
          {SEPARATORS().map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("filum.pannelli.formats")} title={t("filum.pannelli.every_text_is_exported_in")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {quick.map((e) => (
            <button key={e} className={`chip ${state.formats.includes(e) ? "on" : ""}`} onClick={() => toggle(e)} title={formats.find((f) => f.extension === e)?.name}>
              {e.toUpperCase()}
            </button>
          ))}
          {state.formats
            .filter((e) => !quick.includes(e))
            .map((e) => (
              <button key={e} className="chip on" onClick={() => toggle(e)} title={t("filum.pannelli.click_to_remove")}>
                {e.toUpperCase()}
              </button>
            ))}
          {others.length > 0 && (
            <select className="select" value="" onChange={(e) => e.target.value && toggle(e.target.value)} title={t("filum.pannelli.more_formats")} style={{ width: 70 }}>
              <option value="">{t("filum.pannelli.more")}</option>
              {others
                .filter((f) => !state.formats.includes(f.extension))
                .map((f) => (
                  <option key={f.extension} value={f.extension}>
                    {f.extension.toUpperCase()} · {f.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      </Row>
      <button className="btn sm" style={{ width: "100%", marginTop: 6 }} disabled={!total || busy !== null} onClick={run} title={t("filum.pannelli.files_are_named_like_ink")}>
        <FileArchive size={13} />
        {busy !== null ? t("filum.pannelli.exporting_busy", { busy }) : total ? tn("filum.pannelli.export_n_files_zip", total) : t("filum.pannelli.add_texts_and_a_format")}
      </button>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Font: sample sheet and font info

/** The Font section of an embroidery-font lettering. */
export function FontSection({ group, spec, font }: { group: string; spec: TextSpec; font: EmbroideryFont | null }) {
  const [width, setWidth] = useState(() => Number(localStorage.getItem("filum.sampleWidth")) || 180);
  const [editing, setEditing] = useState<string | null>(null);
  const installed = spec.font.startsWith("inkfont:");
  const sample = async () => {
    safeSetItem("filum.sampleWidth", String(width));
    const g = await insertFontSample(spec.font, { size: spec.size, maxWidth: width, variant: spec.variant });
    if (g) {
      selectGroup(g);
      useStore.getState().toast(t("filum.pannelli.sample_sheet_of_v1", { v1: fontLabel(spec.font) }), "success");
    } else useStore.getState().toast(t("filum.pannelli.this_font_has_no_glyphs"), "error");
  };
  const edit = async () => {
    if (installed) return setEditing(spec.font);
    // bundled fonts are read-only: edit a copy and switch this lettering to it
    useStore.getState().toast(t("filum.pannelli.copying_v1", { v1: fontLabel(spec.font) }));
    try {
      const key = await copyBundledFont(spec.font);
      await updateText(group, { font: key });
      setEditing(key);
    } catch (e) {
      useStore.getState().toast(t("filum.pannelli.could_not_copy_the_font", { message: (e as Error).message }), "error");
    }
  };
  const variants = (font?.variants ?? []).map((v) => VARIANT_LABELS[v]?.arrow ?? v).join(" ");
  return (
    <Section title={t("filum.pannelli.font")} defaultOpen={false}>
      <p className="hint" style={{ paddingTop: 2 }}>
        {font ? (
          <>
            {font.name} · {font.names.size}{t("filum.pannelli.glyphs")}{font.size.toFixed(0)}{t("filum.pannelli.mm_at_100")}
            {font.variants.length > 1 ? t("filum.pannelli.directions_variants", { variants }) : ""}
            {font.reversible ? "" : t("filum.pannelli.not_reversible")}
          </>
        ) : (
          t("filum.pannelli.loading_the_font")
        )}
      </p>
      <Row label={t("filum.pannelli.sample_width")} title={t("filum.pannelli.line_width_of_the_sample")}>
        <Num value={width} unit="mm" step={10} min={20} max={1000} digits={0} onChange={setWidth} />
      </Row>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={sample} title={t("filum.pannelli.every_glyph_of_the_font")}>
          <LayoutGrid size={12} />{t("filum.pannelli.insert_sample_sheet")}
        </button>
        <button
          className="btn sm"
          onClick={edit}
          title={installed ? t("filum.pannelli.name_description_spacing_kerning_ink") : t("filum.pannelli.bundled_fonts_are_read_only")}
        >
          <PencilRuler size={12} /> {installed ? t("filum.pannelli.edit_font_info") : t("filum.pannelli.edit_a_copy")}
        </button>
      </div>
      {editing && createPortal(<FontInfoDialog fontKey={editing} onClose={() => setEditing(null)} />, document.body)}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Font editor (Ink/Stitch's Edit JSON)

type Info = Record<string, unknown>;
type Tab = "info" | "settings" | "spacing" | "kerning";
const PREVIEW_THREADS: Thread[] = [{ id: "preview", get name() { return t("filum.pannelli.preview"); }, color: "#1f2a56", brand: "", code: "" }];

const str = (v: unknown, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
const map = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : {});
/** font.json as saved: keywords without empty entries. */
const cleanInfo = (info: Info): Info => (Array.isArray(info.keywords) ? { ...info, keywords: (info.keywords as string[]).filter(Boolean) } : info);

/** Adjacent letter pairs of a text (per word), for kerning. */
function textPairs(text: string): string[] {
  const out = new Set<string>();
  for (const w of text.split(/\s+/)) {
    const cs = Array.from(w);
    for (let i = 1; i < cs.length; i++) out.add(`${cs[i - 1]} ${cs[i]}`);
  }
  return [...out];
}

export function FontInfoDialog({ fontKey, onClose }: { fontKey: string; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [font, setFont] = useState<EmbroideryFont | null>(null);
  const [tab, setTab] = useState<Tab>("spacing");
  const [text, setText] = useState("AVATAR Wave To\nThe quick fox");
  const [preview, setPreview] = useState<DesignObject[]>([]);
  const previewDoc = useMemo(() => ({ ...emptyDoc(), threads: PREVIEW_THREADS, objects: preview }), [preview]);
  const [filter, setFilter] = useState("");
  const [pair, setPair] = useState<[string, string]>(["", ""]);
  useEffect(() => {
    inkFontInfo(fontKey).then((i) => setInfo(i ? { ...FONT_INFO_DEFAULTS, ...i } : null));
    loadFont(fontKey).then((f) => f.kind === "embroidery" && setFont(f));
  }, [fontKey]);
  // live preview with the edited metrics
  useEffect(() => {
    if (!font || !info) return;
    let live = true;
    const f = withFontInfo(font, info);
    const t = setTimeout(() => {
      layoutText(
        { group: "preview", content: text || "Aa", font: fontKey, size: f.size, letterSpacing: 0, lineSpacing: 1, align: "left", arc: 0, rotation: 0, anchor: [0, 0], style: "fill", borderWidth: 1, fillAngle: 45, thread: "preview", borderThread: "preview" },
        f,
      )
        .then((o) => live && setPreview(o.map((x) => ({ ...x, thread: "preview" }))))
        .catch(() => {});
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [font, info, text, fontKey]);
  if (!info) return null;
  const set = (k: string, v: unknown) => setInfo({ ...info, [k]: v });
  const setIn = (k: "horiz_adv_x" | "kerning_pairs", key: string, v: number | null) => {
    const m = { ...map(info[k]) };
    if (v === null) delete m[key];
    else m[key] = v;
    set(k, m);
  };
  const glyphs = (Array.isArray(info.glyphs) ? (info.glyphs as string[]) : [...(font?.names ?? [])]).slice().sort();
  const q = filter.trim();
  const advDefault = info.horiz_adv_x_default == null || info.horiz_adv_x_default === "" ? null : num(info.horiz_adv_x_default, 0);
  const kern = map(info.kerning_pairs);
  const apply = async () => {
    const s = useStore.getState();
    try {
      await saveInkFontInfo(fontKey, cleanInfo(info));
      const n = await refreshLetterings(fontKey);
      s.toast(t("filum.pannelli.font_saved", { name: str(info.name, t("filum.pannelli.font_fallback")) }) + (n ? tn("filum.pannelli.n_letterings_updated", n) : ""), "success");
      onClose();
    } catch (e) {
      s.toast(t("filum.pannelli.could_not_save_the_font", { message: (e as Error).message }), "error");
    }
  };
  const exportJson = async () => {
    const { glyphs: g, ...rest } = cleanInfo(info);
    const out = { ...rest, glyphs: g ?? glyphs };
    const saved = await saveFile("font.json", enc.encode(fontJsonText(out)), [{ name: t("filum.pannelli.ink_stitch_font_info"), extensions: ["json"] }]);
    if (saved) useStore.getState().toast(t("filum.pannelli.saved_font_json_put_it"), "success");
  };
  const remove = async () => {
    const used = useStore.getState().doc.objects.some((o) => o.text?.font === fontKey);
    if (!confirm(t("filum.pannelli.remove_font_from_installed", { name: str(info.name, t("filum.pannelli.this_font")) }) + (used ? t("filum.pannelli.letterings_in_this_design_that") : ""))) return;
    await removeInkFont(fontKey);
    useStore.getState().toast(t("filum.pannelli.v1_removed", { v1: fontLabel(fontKey) }));
    onClose();
  };
  const field = (label: string, k: string, title?: string, area?: boolean) => (
    <label className="field" title={title}>
      <span>{label}</span>
      {area ? (
        <textarea className="input" style={{ width: "100%", height: 54 }} value={str(info[k])} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="input" value={str(info[k])} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );
  const seg = (k: string, opts: [string, string][], title?: string) => (
    <div className="seg" title={title}>
      {opts.map(([v, l]) => (
        <button key={v} className={str(info[k]) === v ? "on" : ""} onClick={() => set(k, v)}>
          {l}
        </button>
      ))}
    </div>
  );
  const kernRow = (key: string, left: string, right: string) => (
    <div key={key} className="row" style={{ gridTemplateColumns: "70px 1fr 28px" }}>
      <label className="mono" style={{ fontSize: "var(--fs-lg)" }}>
        {left} {right}
      </label>
      <Num value={kern[key] ?? kern[left + right] ?? 0} unit="px" step={0.5} digits={1} onChange={(v) => setIn("kerning_pairs", kern[key] === undefined && kern[left + right] !== undefined ? left + right : key, v || null)} />
      {kern[key] !== undefined || kern[left + right] !== undefined ? (
        <button className="icon-btn" title={t("filum.pannelli.remove_the_pair")} onClick={() => setIn("kerning_pairs", kern[key] !== undefined ? key : left + right, null)}>
          <Trash2 size={12} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
  return (
    <Dialog
      live
      wide
      title={t("filum.pannelli.font_info_v1", { v1: str(info.name, fontLabel(fontKey)) })}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={exportJson} title={t("filum.pannelli.ink_stitch_s_font_json")}>
            <FileJson size={13} />{t("filum.pannelli.export_font_json")}
          </button>
          <button className="btn ghost" onClick={remove} title={t("filum.pannelli.uninstall_this_font")}>
            <Trash2 size={13} />{t("filum.pannelli.remove_font")}
          </button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.pannelli.cancel")}
          </button>
          <button className="btn primary" onClick={apply}>
            {t("filum.pannelli.apply")}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 14 }}>
        <div>
          <div className="seg" style={{ marginBottom: 8 }}>
            {(
              [
                ["info", t("filum.pannelli.info")],
                ["settings", t("filum.pannelli.settings")],
                ["spacing", t("filum.pannelli.spacing")],
                ["kerning", t("filum.pannelli.kerning")],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}>
                {l}
              </button>
            ))}
          </div>
          {tab === "info" && (
            <>
              {field("Name", "name")}
              {field("Description", "description", undefined, true)}
              {field("Licence", "font_license")}
              <label className="field" title={t("filum.pannelli.comma_separated_they_become_the")}>
                <span>{t("filum.pannelli.keywords")}</span>
                <input
                  className="input"
                  value={Array.isArray(info.keywords) ? (info.keywords as string[]).join(", ") : str(info.keywords)}
                  onChange={(e) =>
                    set(
                      "keywords",
                      e.target.value.split(",").map((k) => k.trim()).filter((k, i, a) => k || i === a.length - 1),
                    )
                  }
                />
              </label>
              {field("Original font", "original_font", "The font this embroidery font is based on")}
              {field("Original font URL", "original_font_url")}
            </>
          )}
          {tab === "settings" && (
            <>
              <Row label={t("filum.pannelli.size")} title={t("filum.pannelli.cap_height_in_mm_at")}>
                <Num value={num(info.size, 0)} unit="mm" step={0.5} min={0} digits={1} onChange={(v) => set("size", v)} />
              </Row>
              <Row label={t("filum.pannelli.min_scale")} title={t("filum.pannelli.smallest_recommended_scale_1_100")}>
                <Num value={num(info.min_scale, 1)} step={0.05} min={0.05} max={10} digits={2} onChange={(v) => set("min_scale", v)} />
              </Row>
              <Row label={t("filum.pannelli.max_scale")} title={t("filum.pannelli.largest_recommended_scale_1_100")}>
                <Num value={num(info.max_scale, 1)} step={0.05} min={0.05} max={10} digits={2} onChange={(v) => set("max_scale", v)} />
              </Row>
              <Row label={t("filum.pannelli.default_direction")} title={t("filum.pannelli.the_variant_used_unless_a")}>
                <select className="select" style={{ width: "100%" }} value={str(info.default_variant, "ltr")} onChange={(e) => set("default_variant", e.target.value)}>
                  {(font?.variants ?? ["ltr"]).map((v) => (
                    <option key={v} value={v}>
                      {VARIANT_LABELS[v]?.arrow} {VARIANT_LABELS[v]?.name ?? v}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label={t("filum.pannelli.text_direction")} title={t("filum.pannelli.reading_direction_of_the_script")}>
                {seg("text_direction", [
                  ["ltr", t("filum.pannelli.left_to_right")],
                  ["rtl", t("filum.pannelli.right_to_left")],
                ])}
              </Row>
              <Row label={t("filum.pannelli.letter_case")} title={t("filum.pannelli.force_the_text_to_capitals")}>
                {seg("letter_case", [
                  ["", t("filum.pannelli.as_typed")],
                  ["upper", t("filum.pannelli.upper")],
                  ["lower", t("filum.pannelli.lower")],
                ])}
              </Row>
              <Row label={t("filum.pannelli.default_glyph")} title={t("filum.pannelli.shown_for_letters_the_font")}>
                <input className="input" style={{ width: 60 }} value={str(info.default_glyph, "�")} onChange={(e) => set("default_glyph", e.target.value)} />
              </Row>
              <Row label={t("filum.pannelli.back_and_forth")} title={t("filum.pannelli.reversible_letterings_may_stitch_every")}>
                <Toggle on={info.reversible !== false} onChange={(v) => set("reversible", v)} />
              </Row>
              <Row label={t("filum.pannelli.colour_sort")} title={t("filum.pannelli.sortable_multicolour_letterings_may_sew")}>
                <Toggle on={info.sortable === true} onChange={(v) => set("sortable", v)} />
              </Row>
            </>
          )}
          {tab === "spacing" && (
            <>
              <Row label={t("filum.pannelli.line_height")} title={t("filum.pannelli.leading_distance_from_one_baseline")}>
                <Num value={num(info.leading, 100)} unit="px" step={1} digits={1} onChange={(v) => set("leading", v)} />
              </Row>
              <Row label="Space" title={t("filum.pannelli.width_of_a_space_horiz_adv_x_space")}>
                <Num value={num(info.horiz_adv_x_space, 20)} unit="px" step={0.5} digits={1} onChange={(v) => set("horiz_adv_x_space", v)} />
              </Row>
              <Row label={t("filum.pannelli.advance")} title={t("filum.pannelli.default_horizontal_advance_of_a")}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Toggle on={advDefault !== null} onChange={(v) => set("horiz_adv_x_default", v ? 50 : null)} title={t("filum.pannelli.a_fixed_default_advance_instead")} />
                  {advDefault !== null ? <Num value={advDefault} unit="px" step={0.5} digits={1} onChange={(v) => set("horiz_adv_x_default", v)} /> : <span className="hint" style={{ padding: 0 }}>{t("filum.pannelli.glyph_width")}</span>}
                </div>
              </Row>
              <p className="hint">{t("filum.pannelli.per_glyph_advances_empty_the")}</p>
              <input className="input" placeholder={t("filum.pannelli.filter_glyphs")} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
              <div style={{ maxHeight: 220, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "2px 10px" }}>
                {glyphs
                  .filter((g) => !q || g.includes(q))
                  .map((g) => {
                    const v = map(info.horiz_adv_x)[g];
                    return (
                      <div key={g} className="row" style={{ gridTemplateColumns: "34px 1fr" }} title={v === undefined ? t("filum.pannelli.default_advance") : t("filum.pannelli.own_advance_set_to_0")}>
                        <label className="mono" style={{ fontSize: "var(--fs-lg)" }}>
                          {g}
                        </label>
                        <Num value={v ?? 0} unit="px" step={0.5} digits={1} onChange={(n) => setIn("horiz_adv_x", g, n || null)} />
                      </div>
                    );
                  })}
              </div>
            </>
          )}
          {tab === "kerning" && (
            <>
              <p className="hint" style={{ paddingTop: 0 }}>
                {t("filum.pannelli.kerning_moves_the_right_glyph")}
              </p>
              <div style={{ maxHeight: 150, overflow: "auto" }}>
                {textPairs(text)
                  .filter((k) => k.split(" ").every((c) => font?.names.has(c)))
                  .map((k) => {
                    const [l, r] = k.split(" ");
                    return kernRow(k, l, r);
                  })}
              </div>
              <div style={{ display: "flex", gap: 6, margin: "8px 0", alignItems: "center" }}>
                <input className="input" style={{ width: 44 }} placeholder="A" value={pair[0]} onChange={(e) => setPair([e.target.value, pair[1]])} />
                <input className="input" style={{ width: 44 }} placeholder="V" value={pair[1]} onChange={(e) => setPair([pair[0], e.target.value])} />
                <button
                  className="btn sm"
                  disabled={!pair[0] || !pair[1]}
                  onClick={() => {
                    setIn("kerning_pairs", `${pair[0]} ${pair[1]}`, kern[`${pair[0]} ${pair[1]}`] ?? 1);
                    setFilter(pair[0]);
                    setPair(["", ""]);
                  }}
                >
                  {t("filum.pannelli.add_pair")}
                </button>
                <input className="input" placeholder={t("filum.pannelli.filter_pairs")} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
              </div>
              <div style={{ maxHeight: 180, overflow: "auto" }}>
                {kerningRows(kern)
                  .filter((r) => !q || r.left.includes(q) || r.right.includes(q))
                  .slice(0, 400)
                  .map((r) => kernRow(r.key, r.left, r.right))}
                {!Object.keys(kern).length && <p className="hint">{t("filum.pannelli.no_kerning_pairs_yet")}</p>}
              </div>
            </>
          )}
        </div>
        <div>
          <label className="field" title={t("filum.pannelli.type_pairs_to_check_spacing")}>
            <span>{t("filum.pannelli.preview")}</span>
            <textarea className="input" style={{ width: "100%", height: 48 }} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div style={{ height: 224, borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
            <DesignView doc={previewDoc} plan={null} mode="vector" fabricColor="#ffffff" pad={10} />
          </div>
          <p className="hint">{t("filum.pannelli.the_outlines_at_the_font")}</p>
        </div>
      </div>
    </Dialog>
  );
}
