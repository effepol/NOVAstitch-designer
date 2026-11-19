import { t } from "../nova/i18n/filum";
import { ALargeSmall, AlignCenter, AlignJustify, AlignLeft, AlignRight, Check, Download, Search, Type, Unlink } from "lucide-react";
import { LetterSpacing, TextArc } from "../icons/stitch";
import { useEffect, useMemo, useRef, useState } from "react";
import opentype from "opentype.js";
import {
  BUNDLED_OUTLINE,
  embroideryFonts,
  embroideryIndex,
  fontKind,
  fontLabel,
  importedFonts,
  importFontFile,
  importInkFont,
  lettersToFont,
  loadFont,
  systemFonts,
  systemFontsSupported,
  type EmbroideryFont,
  type FontEntry,
} from "../lib/fonts";
import { objectBoundsCached, unionBoxes } from "../lib/geometry";
import { openFile, openFolder } from "../lib/platform";
import { MACHINE_EXT } from "../lib/actions";
import { members, sizeForFont, startSize, type TextSpec, type TextStyle } from "../lib/text";
import { lockedToast, selectedTextGroup, textLocked, updateText } from "../lib/textOps";
import { onDownloadsChange } from "../lib/downloadStore";
import { useStore } from "../store";
import type { FillParams } from "../types";
import { Dialog, Num, Row, Section, Slider, Toggle } from "./ui";
import { BatchSection, FontSection, VARIANT_LABELS } from "./LetteringTools";
import { TransformPanel } from "./TransformPanel";
import { CommandsSection } from "./CommandsSection";
import { ElementInfoSection } from "./ElementInfo";
import { safeSetItem } from "../lib/storage";

/** Reactive spec of a lettering group. */

/** La descrizione dei font vettoriali inclusi (lib/fonts.ts), tradotta solo a schermo. */
const DESC_KEYS: Record<string, string> = { "Rounded sans": "filum.pannelli.font_desc_rounded", "Block capitals": "filum.pannelli.font_desc_block", Script: "filum.pannelli.font_desc_script" };
const descShown = (d?: string) => {
  const letters = d?.match(/^Made from (\d+) letter files$/);
  return letters ? t("filum.pannelli.font_desc_letters", { n: letters[1] }) : d && d in DESC_KEYS ? t(DESC_KEYS[d]) : d;
};

export function useTextSpec(group: string | null): TextSpec | null {
  return useStore((s) => (group ? s.doc.objects.find((o) => o.text?.group === group)?.text ?? null : null));
}

/** Reactive "is the selection one lettering?" */
export function useSelectedTextGroup(): string | null {
  useStore((s) => s.selection);
  useStore((s) => s.doc);
  return selectedTextGroup();
}

/** The loaded embroidery font of a key (null while loading or for outline fonts). */
function useEmbroideryFont(key: string | undefined): EmbroideryFont | null {
  const [font, setFont] = useState<EmbroideryFont | null>(null);
  useEffect(() => {
    let live = true;
    setFont(null);
    if (key && fontKind(key) === "embroidery")
      loadFont(key)
        .then((f) => {
          if (live && f.kind === "embroidery") setFont(f);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);
  return font;
}

const STYLES: { id: TextStyle; label: string; title: string }[] = [
  { id: "fill", get label() { return t("filum.pannelli.fill"); }, get title() { return t("filum.pannelli.tatami_fill"); } },
  { id: "border", get label() { return t("filum.pannelli.satin_edge"); }, get title() { return t("filum.pannelli.satin_column_around_every_letter"); } },
  { id: "fillBorder", get label() { return t("filum.pannelli.fill_edge"); }, get title() { return t("filum.pannelli.fill_with_a_satin_border"); } },
  { id: "outline", get label() { return t("filum.pannelli.outline"); }, get title() { return t("filum.pannelli.triple_running_stitch_outline"); } },
];

const FILL_NAMES: Partial<Record<FillParams["method"], string>> = {
  tatami: "Tatami",
  cross: "Cross stitch",
  contour: "Contour",
  spiral: "Spiral",
  meander: "Meander",
  circular: "Circular",
  guided: "Guided",
  radial: "Radial",
  stipple: "Stipple",
  curved: "Curved",
};
const LETTER_FILLS: FillParams["method"][] = ["tatami", "cross", "contour", "meander", "curved"];

/** Embroidery fonts: the letters' fill — the font's own by default. */
function LetterFill({ group, spec, fontFill, fontScales }: { group: string; spec: TextSpec; fontFill?: FillParams["method"]; fontScales?: boolean }) {
  if (!fontFill) return null;
  const cur = spec.fill ?? "font";
  const crosses = (cur === "font" && fontFill === "cross") || cur === "cross";
  // unset: as the font says (Ink/Stitch scale_cross_stitch_pattern)
  const grow = spec.crossScale ?? !!fontScales;
  return (
    <>
      <Row label={t("filum.pannelli.fill")} title={t("filum.pannelli.the_fill_of_the_letters")}>
        <select className="select" style={{ width: "100%" }} value={cur} onChange={(e) => updateText(group, { fill: e.target.value as TextSpec["fill"] })}>
          <option value="font">{t("filum.pannelli.font_s_own_n", { n: FILL_NAMES[fontFill] ?? fontFill })}</option>
          {LETTER_FILLS.filter((m) => m !== fontFill).map((m) => (
            <option key={m} value={m}>
              {FILL_NAMES[m]}
            </option>
          ))}
        </select>
      </Row>
      {crosses && cur === "font" && (
        <Row
          label={t("filum.pannelli.crosses")}
          title={t("filum.pannelli.cross_size_this_font", { choice: fontScales ? t("filum.pannelli.grow_with_the_letters") : t("filum.pannelli.keep_their_size") })}
        >
          <div className="seg">
            <button className={!grow ? "on" : ""} onClick={() => updateText(group, { crossScale: false })}>
              {t("filum.pannelli.font_size")}
            </button>
            <button className={grow ? "on" : ""} onClick={() => updateText(group, { crossScale: true })}>
              {t("filum.pannelli.grow_with_letters")}
            </button>
          </div>
        </Row>
      )}
    </>
  );
}

function FontButton({ spec }: { spec: TextSpec }) {
  const [, rerender] = useState(0);
  useEffect(() => {
    embroideryIndex()
      .then(() => rerender((n) => n + 1))
      .catch(() => {});
  }, []);
  return (
    <button className="btn sm font-btn" title={t("filum.pannelli.choose_font")} onClick={() => useStore.getState().setDialog("fonts")}>
      <Type size={13} />
      <span>{fontLabel(spec.font)}</span>
      {fontKind(spec.font) === "embroidery" && <span className="badge">{t("filum.pannelli.stitched")}</span>}
    </button>
  );
}

function AlignSeg({ spec, group }: { spec: TextSpec; group: string }) {
  const icons = { left: <AlignLeft size={13} />, center: <AlignCenter size={13} />, right: <AlignRight size={13} />, block: <AlignJustify size={13} /> };
  const titles = { left: "Align left", center: "Centre", right: "Align right", block: "Block: spread every line to the width of the longest (Ink/Stitch Block)" };
  const block = spec.align === "block" || spec.align === "blockLetters";
  return (
    <div className="seg" role="group" aria-label={t("filum.pannelli.alignment")}>
      {(["left", "center", "right", "block"] as const).map((a) => (
        <button
          key={a}
          title={titles[a]}
          className={(a === "block" ? block : spec.align === a) ? "on" : ""}
          onClick={() => !(a === "block" && block) && updateText(group, { align: a })}
        >
          {icons[a]}
        </button>
      ))}
    </div>
  );
}

/** Context bar for a selected lettering. */
export function TextBar({ group }: { group: string }) {
  const spec = useTextSpec(group);
  if (!spec) return null;
  const outline = fontKind(spec.font) === "outline";
  return (
    <div className="contextbar">
      <span className="obj-name">
        <Type size={14} />
        <span>“{spec.content.split("\n")[0]}”</span>
      </span>
      <FontButton spec={spec} />
      <label className="ctx-field" title={t("filum.pannelli.cap_height")}>
        <ALargeSmall size={14} />
        <span className="sr-only">{t("filum.pannelli.cap_height")}</span>
        <Num value={spec.size} unit="mm" step={0.5} min={2} max={200} onChange={(v) => updateText(group, { size: v })} />
      </label>
      {outline && (
        <div className="seg" role="group" aria-label={t("filum.pannelli.style")}>
          {STYLES.map((s) => (
            <button key={s.id} title={s.title} className={spec.style === s.id ? "on" : ""} onClick={() => updateText(group, { style: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <AlignSeg spec={spec} group={group} />
      <label className="ctx-field" title={t("filum.pannelli.arc_bend_positive_arches_up")}>
        <TextArc size={13} />
        <span className="sr-only">{t("filum.pannelli.arc_bend_positive_arches_up")}</span>
        <Num value={spec.arc} unit="°" step={5} min={-330} max={330} digits={0} onChange={(v) => updateText(group, { arc: v })} />
      </label>
      <label className="ctx-field" title={t("filum.pannelli.letter_spacing")}>
        <LetterSpacing size={13} />
        <span className="sr-only">{t("filum.pannelli.letter_spacing")}</span>
        <Num value={spec.letterSpacing} unit="mm" step={0.1} min={-10} max={50} onChange={(v) => updateText(group, { letterSpacing: v })} />
      </label>
      <button className="btn sm" onClick={() => useStore.getState().set({ editingText: group })}>
        {t("filum.pannelli.edit_text")}
      </button>
    </div>
  );
}

/** Properties panel section for a selected lettering. */
export function TextProperties({ group }: { group: string }) {
  const spec = useTextSpec(group);
  const doc = useStore((s) => s.doc);
  const [draft, setDraft] = useState(spec?.content ?? "");
  const typing = useRef(false);
  const emb = useEmbroideryFont(spec?.font);
  useEffect(() => {
    if (!typing.current) setDraft(spec?.content ?? "");
  }, [spec?.content]);
  if (!spec) return null;
  const outline = fontKind(spec.font) === "outline";
  // the glyph objects of this lettering (transform, commands and info act on all of them)
  const groupObjects = doc.objects.filter((o) => o.text?.group === group);
  const live = (patch: Partial<TextSpec>) => {
    // locked: refused before an (empty) undo step is taken
    if (textLocked(group)) return lockedToast();
    if (!typing.current) {
      useStore.getState().checkpoint();
      typing.current = true;
    }
    updateText(group, patch, true);
  };
  const swatches = (cur: string | undefined, pick: (id: string) => void) => (
    <div className="thread-pick">
      {doc.threads.map((t) => (
        <button key={t.id} title={t.name} className={t.id === cur ? "on" : ""} style={{ background: t.color }} onClick={() => pick(t.id)} />
      ))}
    </div>
  );
  const threadPick = (key: "thread" | "borderThread") => swatches(spec[key], (id) => updateText(group, { [key]: id }));
  const palette = spec.palette;
  const fontFill = useStore((s) => s.doc.objects.find((o) => o.text?.group === group)?.text?.fontFill);
  const range = emb ? [emb.size * emb.minScale, emb.size * emb.maxScale] : null;
  const outOfRange = !!range && range[1] > range[0] && (spec.size < range[0] * 0.98 || spec.size > range[1] * 1.02);
  const count = members(doc.objects, group).length;
  return (
    <div className="props">
      <div className="props-head">
        <Type size={15} />
        <span className="grow">{t("filum.pannelli.lettering")}</span>
        <span className="stat">{t("filum.pannelli.count_objects", { count })}</span>
      </div>
      <Section title={t("filum.pannelli.text")}>
        <textarea
          className="input"
          style={{ width: "100%", height: 64, fontSize: "var(--fs-lg)" }}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) live({ content: e.target.value });
          }}
          onBlur={() => {
            typing.current = false;
            setDraft(spec.content);
          }}
        />
        <Row label={t("filum.pannelli.font")}>
          <FontButton spec={spec} />
        </Row>
        <Row label={t("filum.pannelli.cap_height")}>
          <Slider min={3} max={80} step={0.5} unit="mm" value={spec.size} onChange={(v) => updateText(group, { size: v })} />
        </Row>
        <Row label={t("filum.pannelli.letter_spacing")}>
          <Slider min={-3} max={10} step={0.1} unit="mm" value={spec.letterSpacing} onChange={(v) => updateText(group, { letterSpacing: v })} />
        </Row>
        <Row label={t("filum.pannelli.word_spacing")} title={t("filum.pannelli.extra_space_between_words_ink")}>
          <Slider min={-5} max={20} step={0.1} unit="mm" value={spec.wordSpacing ?? 0} onChange={(v) => updateText(group, { wordSpacing: v })} />
        </Row>
        <Row label={t("filum.pannelli.line_spacing")}>
          <Slider min={0.6} max={2.5} step={0.05} unit="×" value={spec.lineSpacing} onChange={(v) => updateText(group, { lineSpacing: v })} />
        </Row>
        <Row label={t("filum.pannelli.align")}>
          <AlignSeg spec={spec} group={group} />
        </Row>
        {(spec.align === "block" || spec.align === "blockLetters") && (
          <Row label={t("filum.pannelli.one_word_lines")} title={t("filum.pannelli.block_alignment_widens_the_gaps")}>
            <div className="seg">
              <button className={spec.align === "block" ? "on" : ""} onClick={() => updateText(group, { align: "block" })}>
                {t("filum.pannelli.keep")}
              </button>
              <button className={spec.align === "blockLetters" ? "on" : ""} onClick={() => updateText(group, { align: "blockLetters" })}>
                {t("filum.pannelli.spread_letters")}
              </button>
            </div>
          </Row>
        )}
      </Section>
      {spec.path && (
        <Section title={t("filum.pannelli.on_a_path")}>
          <Row label={t("filum.pannelli.place_2")} title={t("filum.pannelli.where_the_text_sits_along")}>
            <div className="seg">
              {(
                [
                  ["start", t("filum.pannelli.start_2")],
                  ["center", t("filum.pannelli.centre")],
                  ["end", "End"],
                  ["stretch", t("filum.pannelli.stretch")],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={(spec.pathAlign ?? "center") === v ? "on" : ""} onClick={() => updateText(group, { pathAlign: v })}>
                  {l}
                </button>
              ))}
            </div>
          </Row>
          <Row label={t("filum.pannelli.side")} title={t("filum.pannelli.letters_on_top_of_the")}>
            <div className="seg">
              <button className={!spec.pathFlip ? "on" : ""} onClick={() => updateText(group, { pathFlip: false })}>
                {t("filum.pannelli.above")}
              </button>
              <button className={spec.pathFlip ? "on" : ""} onClick={() => updateText(group, { pathFlip: true })}>
                {t("filum.pannelli.below")}
              </button>
            </div>
          </Row>
          <button className="btn sm ghost" onClick={() => updateText(group, { path: undefined })} title={t("filum.pannelli.back_to_straight_text_at")}>
            {t("filum.pannelli.off_the_path")}
          </button>
        </Section>
      )}
      <Section title={t("filum.pannelli.shape")}>
        <Row label={t("filum.pannelli.arc")} title={t("filum.pannelli.bend_the_text_along_a")}>
          <Slider min={-330} max={330} step={1} digits={0} unit="°" value={spec.arc} onChange={(v) => updateText(group, { arc: v })} />
        </Row>
        <Row label={t("filum.pannelli.rotation")}>
          <Num value={spec.rotation} unit="°" step={5} digits={1} onChange={(v) => updateText(group, { rotation: v })} />
        </Row>
      </Section>
      <Section title={t("filum.pannelli.stitches")}>
        {outline ? (
          <>
            <Row label={t("filum.pannelli.style")}>
              <select className="select" style={{ width: "100%" }} value={spec.style} onChange={(e) => updateText(group, { style: e.target.value as TextStyle })}>
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Row>
            {(spec.style === "fill" || spec.style === "fillBorder") && (
              <Row label={t("filum.pannelli.fill_angle")}>
                <Slider min={-90} max={90} step={1} digits={0} unit="°" value={spec.fillAngle} onChange={(v) => updateText(group, { fillAngle: v })} />
              </Row>
            )}
            {(spec.style === "border" || spec.style === "fillBorder") && (
              <Row label={t("filum.pannelli.edge_width")}>
                <Slider min={0.5} max={4} step={0.1} unit="mm" value={spec.borderWidth} onChange={(v) => updateText(group, { borderWidth: v })} />
              </Row>
            )}
          </>
        ) : (
          <>
          <LetterFill group={group} spec={spec} fontFill={fontFill} fontScales={emb?.scaleCrossStitch} />
          {emb && emb.variants.length > 1 && (
            <Row label={t("filum.pannelli.direction")} title={t("filum.pannelli.the_direction_the_letters_are")}>
              <div className="seg">
                {emb.variants.map((v) => (
                  <button
                    key={v}
                    title={`${VARIANT_LABELS[v]?.name ?? v}${v === emb.variant ? t("filum.pannelli.the_font_s_default") : ""}`}
                    className={(spec.variant && emb.variants.includes(spec.variant) ? spec.variant : emb.variant) === v ? "on" : ""}
                    onClick={() => updateText(group, { variant: v === emb.variant ? undefined : v })}
                  >
                    {VARIANT_LABELS[v]?.arrow ?? v}
                  </button>
                ))}
              </div>
            </Row>
          )}
          <Row
            label={t("filum.pannelli.back_and_forth")}
            title={
              emb && !emb.reversible
                ? t("filum.pannelli.this_font_is_digitized_to")
                : t("filum.pannelli.stitch_every_second_line_the")
            }
          >
            {emb && !emb.reversible ? (
              <span className="hint" style={{ padding: 0 }}>
                {t("filum.pannelli.not_for_this_font")}
              </span>
            ) : (
              <Toggle on={!!spec.backAndForth} onChange={(v) => updateText(group, { backAndForth: v })} />
            )}
          </Row>
          <Row label={t("filum.pannelli.trims")} title={t("filum.pannelli.trim_the_thread_after_every")}>
            <div className="seg">
              {(
                [
                  ["never", t("filum.pannelli.never")],
                  ["letter", t("filum.pannelli.letters")],
                  ["word", t("filum.pannelli.words")],
                  ["line", t("filum.pannelli.lines")],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={(spec.trims ?? "never") === v ? "on" : ""} onClick={() => updateText(group, { trims: v })}>
                  {l}
                </button>
              ))}
            </div>
          </Row>
          <p className={`hint ${outOfRange ? "warn" : ""}`}>
            {t("filum.pannelli.pre_digitized_ink_stitch_embroidery")}
            {range &&
              (range[1] > range[0]
                ? t("filum.pannelli.designed_for_range", { from: range[0].toFixed(0), to: range[1].toFixed(0) }) + (outOfRange ? t("filum.pannelli.outside_this_range_stitches_get") : ".")
                : t("filum.pannelli.designed_for_v1_mm", { v1: range[0].toFixed(0) }))}
          </p>
          </>
        )}
        {!outline && emb?.sortable && (
          <Row label={t("filum.pannelli.colour_order")} title={t("filum.pannelli.sew_the_font_s_colours")}>
            <div className="seg">
              {(
                [
                  ["off", t("filum.pannelli.as_drawn")],
                  ["all", t("filum.pannelli.text")],
                  ["line", t("filum.pannelli.line")],
                  ["word", t("filum.pannelli.word")],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={(spec.colorSort ?? "off") === v ? "on" : ""} onClick={() => updateText(group, { colorSort: v })}>
                  {l}
                </button>
              ))}
            </div>
          </Row>
        )}
        {palette && palette.length > 1 ? (
          palette.map((tid, i) => (
            <Row key={i} label={t("filum.pannelli.colour_v1", { v1: i + 1 })}>
              {swatches(tid, (id) => {
                const next = [...palette];
                next[i] = id;
                updateText(group, { palette: next, ...(i === 0 ? { thread: id } : {}) });
              })}
            </Row>
          ))
        ) : (
          <Row label={spec.style === "fillBorder" && outline ? t("filum.pannelli.fill_colour") : t("filum.pannelli.colour")}>{threadPick("thread")}</Row>
        )}
        {spec.style === "fillBorder" && outline && <Row label={t("filum.pannelli.edge_colour")}>{threadPick("borderThread")}</Row>}
      </Section>
      {!outline && <FontSection group={group} spec={spec} font={emb} />}
      <BatchSection group={group} spec={spec} />
      <Section title={t("filum.pannelli.transform")} defaultOpen={false}>
        <TransformPanel objects={groupObjects} />
      </Section>
      <CommandsSection objects={groupObjects} />
      <ElementInfoSection ids={groupObjects.map((o) => o.id)} />
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button className="btn sm" onClick={() => useStore.getState().set({ editingText: group })}>
          {t("filum.pannelli.edit_on_canvas")}
        </button>
        <button
          className="btn sm ghost"
          title={t("filum.pannelli.turn_into_ordinary_shapes_no")}
          onClick={() => useStore.getState().commit((d) => ({ ...d, objects: d.objects.map((o) => (o.text?.group === group ? { ...o, text: undefined } : o)) }))}
        >
          <Unlink size={12} />{t("filum.pannelli.convert_to_shapes")}
        </button>
      </div>
    </div>
  );
}

/** Floating editor that appears under a lettering while typing. */
export function TextEditorOverlay() {
  const group = useStore((s) => s.editingText);
  const doc = useStore((s) => s.doc);
  const view = useStore((s) => s.view);
  const ref = useRef<HTMLTextAreaElement>(null);
  const spec = useTextSpec(group);
  const [value, setValue] = useState(spec?.content ?? "");
  const started = useRef(false);
  useEffect(() => {
    // a locked lettering can't be edited (double-click on the canvas or in Layers)
    if (group && textLocked(group)) {
      lockedToast();
      useStore.getState().set({ editingText: null });
      return;
    }
    setValue(spec?.content ?? "");
    started.current = false;
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);
  if (!group || !spec) return null;
  const box = unionBoxes(members(doc.objects, group).map(objectBoundsCached)) ?? { x: spec.anchor[0], y: spec.anchor[1], w: 0, h: 0 };
  const left = view.ox + (box.x + box.w / 2) * view.scale;
  const top = view.oy + (box.y + box.h) * view.scale + 12;
  const close = () => {
    const s = useStore.getState();
    if (!value.trim() && !textLocked(group)) {
      // emptied text removes the lettering (not a locked one)
      s.commit((d) => ({ ...d, objects: d.objects.filter((o) => o.text?.group !== group) }));
    }
    s.set({ editingText: null });
  };
  return (
    <div className="text-editor" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={value}
        rows={Math.min(6, value.split("\n").length)}
        placeholder={t("filum.pannelli.type_2")}
        onChange={(e) => {
          setValue(e.target.value);
          if (!e.target.value.trim()) return;
          if (!started.current) {
            useStore.getState().checkpoint();
            started.current = true;
          }
          updateText(group, { content: e.target.value }, true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            close();
          }
          e.stopPropagation();
        }}
        onBlur={close}
      />
      <span className="text-editor-hint">
        <Check size={11} />{t("filum.pannelli.esc_or_click_outside_to")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Font picker

function OutlinePreview({ entry, text }: { entry: FontEntry; text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancel = false;
    loadFont(entry.key)
      .then((f) => {
        if (cancel || f.kind !== "outline" || !ref.current) return;
        const c = ref.current;
        const dpr = window.devicePixelRatio || 1;
        c.width = 220 * dpr;
        c.height = 46 * dpr;
        const g = c.getContext("2d")!;
        g.clearRect(0, 0, c.width, c.height);
        const size = 30 * dpr;
        const w = f.font.getAdvanceWidth(text, size);
        const k = Math.min(1, (c.width - 12 * dpr) / w);
        const p = (f.font as opentype.Font).getPath(text, 6 * dpr, 34 * dpr, size * k);
        p.fill = "#222";
        p.draw(g);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [entry.key, text]);
  return <canvas ref={ref} style={{ width: 220, height: 46 }} />;
}

type Tab = "embroidery" | "outline" | "system";

export function FontPickerDialog({ onClose }: { onClose: () => void }) {
  const group = selectedTextGroup();
  const spec = useTextSpec(group);
  const current = spec?.font;
  const sample = (spec?.content.split("\n")[0] || "Filum").slice(0, 16);
  const [tab, setTab] = useState<Tab>(current && fontKind(current) === "embroidery" ? "embroidery" : "outline");
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<FontEntry[]>([]);
  const [imported, setImported] = useState<FontEntry[]>([]);
  const [system, setSystem] = useState<FontEntry[] | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  useEffect(() => {
    importedFonts().then(setImported);
    const load = () =>
      embroideryFonts()
        .then(setLibrary)
        .catch(() => {});
    load();
    return onDownloadsChange(load);
  }, []);
  // the most common keywords as quick filters
  const tags = useMemo(() => {
    const n = new Map<string, number>();
    for (const f of library) for (const k of f.keywords ?? []) n.set(k, (n.get(k) ?? 0) + 1);
    return [...n.entries()]
      .filter(([, c]) => c >= 3)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 18)
      .map(([k]) => k);
  }, [library]);
  const list = useMemo(() => {
    // installed Ink/Stitch fonts (imported, copies, made from letters) first among the embroidery fonts
    const installed = imported.filter((f) => f.kind === "embroidery");
    let all = tab === "embroidery" ? [...installed, ...library] : tab === "outline" ? [...BUNDLED_OUTLINE, ...imported.filter((f) => f.kind === "outline")] : system ?? [];
    if (tab === "embroidery" && tag) all = all.filter((f) => f.keywords?.includes(tag));
    const q = query.trim().toLowerCase();
    return q
      ? all.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.description?.toLowerCase().includes(q) ||
            f.keywords?.some((k) => k.toLowerCase().includes(q)) ||
            f.original?.toLowerCase().includes(q),
        )
      : all;
  }, [tab, library, imported, system, query, tag]);

  const choose = async (key: string) => {
    const entry = library.find((f) => f.key === key);
    if (entry?.download && !entry.installed) {
      // not included: its licence is accepted and the font downloaded in Preferences
      onClose();
      useStore.getState().openSettings("downloads");
      return;
    }
    if (group) {
      useStore.getState().toast(t("filum.pannelli.loading_v1", { v1: fontLabel(key) }));
      // Ink/Stitch keeps the scale, within the new font's range
      const [to, from] = await Promise.all([loadFont(key).catch(() => null), spec ? loadFont(spec.font).catch(() => null) : null]);
      const size = to && spec ? sizeForFont(spec.size, from, to) : undefined;
      await updateText(group, { font: key, ...(size !== undefined && size !== spec?.size ? { size } : {}) });
    } else {
      // new text starts at the font's own size
      let d: Record<string, unknown> = {};
      try {
        d = JSON.parse(localStorage.getItem("filum.textDefaults") ?? "{}");
      } catch {
        /* unreadable: start afresh */
      }
      const to = await loadFont(key).catch(() => null);
      safeSetItem("filum.textDefaults", JSON.stringify({ ...d, font: key, ...(to?.kind === "embroidery" ? { size: startSize(to) } : {}) }));
      useStore.getState().toast(t("filum.pannelli.v1_will_be_used_for", { v1: fontLabel(key) }));
    }
    onClose();
  };
  const importInk = async () => {
    const files = await openFolder();
    if (!files) return;
    try {
      const key = await importInkFont(files);
      setImported(await importedFonts());
      setTab("embroidery");
      await choose(key);
    } catch (e) {
      useStore.getState().toast(t("filum.pannelli.not_an_ink_stitch_font", { message: (e as Error).message }), "error");
    }
  };
  const fromLetters = async () => {
    const files = await openFolder([...MACHINE_EXT, "svg"]);
    if (!files) return;
    const s = useStore.getState();
    s.toast(t("filum.pannelli.making_a_font_from_the"));
    try {
      const { key, letters } = await lettersToFont(files);
      setImported(await importedFonts());
      setTab("embroidery");
      await choose(key);
      useStore.getState().toast(t("filum.pannelli.v1_letters_letters_fine_tune", { v1: fontLabel(key), letters }), "success");
    } catch (e) {
      s.toast(t("filum.pannelli.letters_to_font_message", { message: (e as Error).message }), "error");
    }
  };
  const importFont = async () => {
    const f = await openFile([{ name: t("filum.pannelli.fonts"), extensions: ["ttf", "otf"] }]);
    if (!f) return;
    try {
      const key = await importFontFile(f.name, f.bytes);
      setImported(await importedFonts());
      setTab("outline");
      await choose(key);
    } catch (e) {
      useStore.getState().toast(t("filum.pannelli.not_a_usable_font_message", { message: (e as Error).message }), "error");
    }
  };

  return (
    <Dialog
      live
      wide
      title={t("filum.pannelli.fonts")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={importFont}>
            {t("filum.pannelli.import_ttf_otf")}
          </button>
          <button className="btn" onClick={importInk} title={t("filum.pannelli.a_folder_with_font_json")}>
            {t("filum.pannelli.import_ink_stitch_font")}
          </button>
          <button
            className="btn"
            onClick={fromLetters}
            title={t("filum.pannelli.letters_to_font_a_folder")}
          >
            {t("filum.pannelli.letters_to_font")}
          </button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.pannelli.close")}
          </button>
        </>
      }
    >
      <div className="font-tabs">
        <div className="seg">
          <button className={tab === "embroidery" ? "on" : ""} onClick={() => setTab("embroidery")}>
            {t("filum.pannelli.embroidery_fonts_library", { library: library.length })}</button>
          <button className={tab === "outline" ? "on" : ""} onClick={() => setTab("outline")}>
            {t("filum.pannelli.outline_fonts")}
          </button>
          <button
            className={tab === "system" ? "on" : ""}
            onClick={async () => {
              setTab("system");
              if (system === null) {
                try {
                  setSystem(await systemFonts());
                } catch {
                  setSystem([]);
                }
              }
            }}
          >
            {t("filum.pannelli.system_fonts")}
          </button>
        </div>
        <label className="ctx-field" style={{ flex: 1 }}>
          <Search size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("filum.pannelli.search_fonts")} style={{ width: "100%", textAlign: "left" }} />
        </label>
      </div>
      <p className="hint" style={{ padding: "6px 2px" }}>
        {tab === "embroidery" &&
          t("filum.pannelli.the_ink_stitch_community_collection")}
        {tab === "outline" && t("filum.pannelli.regular_fonts_stitched_as_fill")}
        {tab === "system" && (systemFontsSupported() ? t("filum.pannelli.fonts_installed_on_this_computer") : t("filum.pannelli.this_browser_can_t_list"))}
      </p>
      {tab === "embroidery" && tags.length > 0 && (
        <div className="font-tags">
          {tags.map((t) => (
            <button key={t} className={`chip ${tag === t ? "on" : ""}`} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="font-grid">
        {list.map((f) => (
          <button
            key={f.key}
            className={`font-card ${f.key === current ? "on" : ""} ${f.download && !f.installed ? "to-download" : ""}`}
            onClick={() => choose(f.key)}
            title={
              f.download && !f.installed
                ? t("filum.pannelli.optional_download_license_preferences_downloads", { license: String(f.license) })
                : [descShown(f.description), f.original && t("filum.pannelli.based_on", { original: f.original }), f.license].filter(Boolean).join("\n") || f.name
            }
          >
            <div className="font-preview">
              {f.download && !f.installed ? (
                <span className="font-dl">
                  <Download size={16} />
                  {t("filum.pannelli.optional_download")}
                </span>
              ) : f.kind === "embroidery" && f.preview ? (
                <img src={f.preview} alt="" loading="lazy" />
              ) : f.kind === "embroidery" ? (
                <span style={{ fontSize: "var(--fs-md)", color: "var(--muted)" }}>{t("filum.pannelli.installed_font")}</span>
              ) : f.source === "system" ? (
                <span style={{ fontFamily: `"${f.description}", sans-serif`, fontSize: 24 }}>{sample}</span>
              ) : (
                <OutlinePreview entry={f} text={sample} />
              )}
            </div>
            <b>{f.name}</b>
            {f.description && f.source !== "system" && <span className="font-desc">{descShown(f.description)}</span>}
            {f.kind === "embroidery" && !!f.size && (
              <span className="font-meta">
                {f.minScale && f.maxScale && f.maxScale > f.minScale
                  ? `${(f.size * f.minScale).toFixed(0)}–${(f.size * f.maxScale).toFixed(0)} mm`
                  : `${f.size.toFixed(0)} mm`}
                {" · "}
                {f.glyphs}{t("filum.pannelli.glyphs_2")}{f.direction === "rtl" ? t("filum.pannelli.rtl") : ""}
              </span>
            )}
            {f.kind === "embroidery" && f.license && (/\bNC\b/.test(f.license) || /non.?commercial/i.test(f.license)) && (
              <span className="font-meta warn" title={f.license}>
                {t("filum.pannelli.non_commercial_licence")}
              </span>
            )}
          </button>
        ))}
        {!list.length && <p className="hint">{tab === "system" && system === null ? t("filum.pannelli.loading") : t("filum.pannelli.no_fonts_found")}</p>}
      </div>
    </Dialog>
  );
}
