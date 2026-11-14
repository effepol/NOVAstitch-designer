// How threads are matched to spools when fitting: presets and every option of
// lib/threadMatch.ts, with a live preview of the result (nothing changes
// until "Fit all").

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fitTargetId, loadMatchOptions, myLines, previewFit, saveMatchOptions, useMyThreads, type FitTarget } from "../lib/threads";
import { MATCH_PRESETS, type MatchOptions } from "../lib/threadMatch";
import { useStore } from "../store";
import { Grip, Num, Row, Slider, Toggle, useMovable } from "./ui";
import { t } from "../nova/i18n/filum";

/** The match options, shared by the panel and the fit (localStorage). */
export function useMatchOptions(): [MatchOptions, (p: Partial<MatchOptions>, preset?: MatchOptions["preset"]) => void] {
  const [o, setO] = useState(loadMatchOptions);
  const set = (p: Partial<MatchOptions>, preset: MatchOptions["preset"] = "custom") => {
    setO((cur) => {
      const next = { ...cur, ...p, weights: { ...cur.weights, ...(p.weights ?? {}) }, preset };
      saveMatchOptions(next);
      return next;
    });
  };
  return [o, set];
}

const presetLabel = (id: MatchOptions["preset"]) => MATCH_PRESETS.find((p) => p.id === id)?.label ?? "Custom";

export function MatchButton({ target, opts, set }: { target: FitTarget; opts: MatchOptions; set: (p: Partial<MatchOptions>, preset?: MatchOptions["preset"]) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} className={`btn sm ${open ? "on" : ""}`} onClick={() => setOpen((v) => !v)} title={t("filum.finestre.how_threads_are_matched_to")}>
        <SlidersHorizontal size={13} /> {presetLabel(opts.preset)}
        <ChevronDown size={12} />
      </button>
      {open && btn.current && <MatchPanel anchor={btn.current} target={target} opts={opts} set={set} onClose={() => setOpen(false)} />}
    </>
  );
}

function MatchPanel({ anchor, target, opts, set, onClose }: { anchor: HTMLElement; target: FitTarget; opts: MatchOptions; set: (p: Partial<MatchOptions>, preset?: MatchOptions["preset"]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const doc = useStore((s) => s.doc);
  const mine = useMyThreads();
  const brands = myLines(mine).map((b) => b.brand);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewFit>>>(null);
  const mv = useMovable("match");
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = 360;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)), top: Math.min(r.bottom + 4, window.innerHeight - 560) });
  }, [anchor]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [anchor, onClose]);
  // live preview of the fit with these options
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => previewFit(target, opts).then((p) => live && setPreview(p)), 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTargetId(target), opts, doc]);
  return createPortal(
    <div className="match-panel" ref={ref} style={{ ...pos, transform: mv.moved ? `translate(${mv.off[0]}px, ${mv.off[1]}px)` : undefined }} data-movable>
      <Grip grip={mv.grip} label={t("filum.finestre.thread_matching")} />
      <div className="mp-presets">
        {MATCH_PRESETS.map((p) => (
          <button key={p.id} className={opts.preset === p.id ? "on" : ""} title={p.hint} onClick={() => set(p.opts, p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="hint">{MATCH_PRESETS.find((p) => p.id === opts.preset)?.hint ?? t("filum.finestre.your_own_settings")}</p>

      <div className="mp-sec">{t("filum.finestre.colour_difference")}</div>
      <Row label={t("filum.finestre.lightness")} title={t("filum.finestre.how_much_lightness_differences_count")}>
        <Slider min={0.25} max={3} step={0.05} value={opts.weights.l} onChange={(v) => set({ weights: { ...opts.weights, l: v } })} />
      </Row>
      <Row label={t("filum.finestre.saturation")} title={t("filum.finestre.how_much_saturation_chroma_differences")}>
        <Slider min={0.25} max={3} step={0.05} value={opts.weights.c} onChange={(v) => set({ weights: { ...opts.weights, c: v } })} />
      </Row>
      <Row label={t("filum.finestre.hue")} title={t("filum.finestre.how_much_hue_shifts_count")}>
        <Slider min={0.25} max={3} step={0.05} value={opts.weights.h} onChange={(v) => set({ weights: { ...opts.weights, h: v } })} />
      </Row>
      <Row label={t("filum.finestre.saturation_boost")} title={t("filum.finestre.match_against_more_saturated_colours")}>
        <Slider min={0} max={0.6} step={0.05} value={opts.saturationBias} onChange={(v) => set({ saturationBias: v })} />
      </Row>

      <div className="mp-sec">{t("filum.finestre.keep_colours_apart")}</div>
      <Row label={t("filum.finestre.one_spool_each")} title={t("filum.finestre.different_colours_get_different_spools")}>
        <Toggle on={opts.unique} onChange={(v) => set({ unique: v })} />
      </Row>
      <Row label={t("filum.finestre.min_distance")} title={t("filum.finestre.fitted_colours_stay_at_least")}>
        <Slider min={0} max={20} step={1} digits={0} unit="ΔE" value={opts.minSeparation} onChange={(v) => set({ minSeparation: v })} />
      </Row>
      <Row label={t("filum.finestre.light_order")} title={t("filum.finestre.a_lighter_colour_never_gets")}>
        <Toggle on={opts.keepLightOrder} onChange={(v) => set({ keepLightOrder: v })} />
      </Row>
      <Row label={t("filum.finestre.neighbour_contrast")} title={t("filum.finestre.colours_that_touch_in_the")}>
        <Toggle on={opts.keepContrast} onChange={(v) => set({ keepContrast: v })} />
      </Row>

      <div className="mp-sec">{t("filum.finestre.spools")}</div>
      <Row label={t("filum.finestre.spool_budget")} title={t("filum.finestre.use_at_most_this_many")}>
        <span className="dz-inline">
          <Num value={opts.budget} min={0} max={64} step={1} digits={0} onChange={(v) => set({ budget: Math.round(v) })} />
          <span className="stat">{opts.budget ? t("filum.finestre.spools_2") : t("filum.finestre.no_limit")}</span>
        </span>
      </Row>
      <Row label={t("filum.finestre.prefer_owned")} title={t("filum.finestre.with_a_chart_as_target")}>
        <Toggle on={opts.preferOwned} onChange={(v) => set({ preferOwned: v })} />
      </Row>
      <Row label={t("filum.finestre.prefer_brand")} title={t("filum.finestre.spools_of_this_brand_win")}>
        <select className="select" value={opts.preferBrand} onChange={(e) => set({ preferBrand: e.target.value })}>
          <option value="">{t("filum.finestre.any")}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("filum.finestre.fabric_aware")} title={t("filum.finestre.avoid_spools_that_almost_match")}>
        <span className="dz-inline">
          <Toggle on={opts.fabricAware} onChange={(v) => set({ fabricAware: v })} />
          {opts.fabricAware && <Num value={opts.fabricMinDelta} min={2} max={30} step={1} digits={0} unit="ΔE" onChange={(v) => set({ fabricMinDelta: v })} />}
        </span>
      </Row>

      <div className="mp-preview">
        {preview ? (
          <>
            <span>
              {t("filum.finestre.e_avg")}<b>{preview.mean.toFixed(1)}</b>{t("filum.finestre.worst")}<b className={preview.worst > 6 ? "far" : ""}>{preview.worst.toFixed(1)}</b>
            </span>
            <span>
              <b>{preview.spools}</b>{t("filum.finestre.spools_3")}{preview.merged ? t("filum.finestre.merged_merged", { merged: preview.merged }) : ""}
              {preview.poor ? t("filum.finestre.poor_poor", { poor: preview.poor }) : ""}
            </span>
          </>
        ) : (
          <span className="stat">{target.kind === "mine" && !mine.length ? t("filum.finestre.my_threads_is_empty") : t("filum.finestre.preview_dots")}</span>
        )}
      </div>
    </div>,
    document.body,
  );
}
