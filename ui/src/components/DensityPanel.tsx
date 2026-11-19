// The density map's legend: what the colours mean on this fabric, how much
// of the design is thin / normal / heavy / too dense, a readout under the
// pointer, and the places that are too dense, one after the other.

import { t, tn } from "../nova/i18n/filum";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, ChevronRight } from "lucide-react";
import { fitView } from "../canvas/Canvas";
import { classShares, CLASS_LABELS, colorAt, DENSITY_MODES, densityAt, densityHover, densityScale, THIN_BLUE } from "../lib/density";
import { defaultDesignOptions } from "../lib/geometry";
import { fabricInfo } from "../lib/materials";
import { useStore } from "../store";

const pct = (v: number) => (v > 0 && v < 0.005 ? "<1" : Math.round(v * 100).toString());

export function DensityLegend() {
  const on = useStore((s) => s.showDensity);
  const f = useStore((s) => s.density);
  const mode = useStore((s) => s.densityMode);
  const fabric = useStore((s) => s.doc.fabric);
  const objects = useStore((s) => s.doc.objects);
  const removeOverlaps = useStore((s) => !!s.doc.options?.removeOverlaps);
  const set = useStore((s) => s.set);
  const hover = useSyncExternalStore(densityHover.subscribe, densityHover.get);
  const [hot, setHot] = useState(-1);
  if (!on) return null;
  const scale = densityScale(mode, f?.limits ?? null);
  // the bar: the scale's colours, a little stronger than on the canvas
  const steps = 24;
  const grad = Array.from({ length: steps + 1 }, (_, k) => {
    const c = colorAt(scale, (scale.max * k) / steps);
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.min(1, c[3] * 1.35 + 0.08).toFixed(2)}) ${((k / steps) * 100).toFixed(1)}%`;
  }).join(",");
  const read = hover ? densityAt(f, hover) : null;
  const shares = f ? classShares(f.stats) : null;
  const spots = f?.hotspots ?? [];
  const fab = fabricInfo(fabric);
  // fills stacked on fills: Remove hidden stitching takes the layers out
  const stacked = !removeOverlaps && spots.some((h) => h.objects.filter((i) => objects[i]?.stitch.type === "fill").length >= 2);

  const showHot = (k: number) => {
    const h = spots[k];
    if (!h) return;
    setHot(k);
    const s = useStore.getState();
    const ids = h.objects.map((i) => s.doc.objects[i]?.id).filter((x): x is string => !!x);
    if (ids.length) s.select(ids);
    const el = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
    if (!el) return;
    const pad = Math.max(0, 16 - Math.max(h.w, h.h)) / 2;
    s.setView(fitView(el.width, el.height, { x: h.x - pad, y: h.y - pad, w: h.w + 2 * pad, h: h.h + 2 * pad }));
  };

  return (
    <div className="density-legend" role="region" aria-label={t("filum.pannelli.density_map")}>
      <div className="dl-head">
        <b>{t("filum.pannelli.density")}</b>
        <span className="stat" title={t("filum.pannelli.limits_for_v1_change_the", { v1: fab.label.toLowerCase() })}>
          {t("filum.pannelli.on_label", { label: fab.label.toLowerCase() })}
        </span>
        <button className="mini-x" onClick={() => set({ showDensity: false })} aria-label={t("filum.pannelli.hide_density_map")} title={t("filum.pannelli.hide_shift_d")}>
          ×
        </button>
      </div>
      <div className="seg dl-modes">
        {DENSITY_MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? "on" : ""} title={m.title} onClick={() => set({ densityMode: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="dl-scale">
        {mode === "coverage" && (
          <span className="dl-thin" title={t("filum.pannelli.a_fill_or_satin_so")}>
            <i style={{ background: `rgb(${THIN_BLUE.join(",")})` }} />{t("filum.pannelli.thin")}
          </span>
        )}
        <div className="dl-bar" style={{ background: `linear-gradient(90deg, ${grad})` }}>
          {scale.ticks.map((t) => (
            <span key={t.label} className="dl-tick" style={{ left: `${(t.v / scale.max) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <span className="stat dl-unit">{scale.unit}</span>
      </div>
      {shares && f!.stats.area > 0 ? (
        <div className="dl-shares" title={t("filum.pannelli.share_of_the_stitched_area")}>
          <div className="dl-stack">
            {mode === "coverage" && <i className="c-thin" style={{ width: `${shares.thin * 100}%` }} />}
            <i className="c-ok" style={{ width: `${(shares.ok + (mode === "coverage" ? 0 : shares.thin)) * 100}%` }} />
            <i className="c-heavy" style={{ width: `${shares.heavy * 100}%` }} />
            <i className="c-risk" style={{ width: `${shares.risk * 100}%` }} />
          </div>
          <span className="stat">
            {shares.thin > 0.005 && <>{t("filum.pannelli.n_thin", { n: pct(shares.thin) })}</>}
            {pct(shares.ok)}{t("filum.pannelli.ok")}{pct(shares.heavy)}{t("filum.pannelli.heavy_2")}<b className={shares.risk > 0 ? "lvl-error" : ""}>{t("filum.pannelli.n_too_dense", { n: pct(shares.risk) })}</b>
          </span>
        </div>
      ) : (
        <span className="stat">{f ? t("filum.pannelli.no_stitches") : t("filum.pannelli.measuring")}</span>
      )}
      <div className="dl-read">
        {read ? (
          <>
            <span title={t("filum.pannelli.layers_of_thread_1_just")}>
              <b>{read.layers.toFixed(1)}</b>{t("filum.pannelli.layers_2")}
            </span>
            <span title={t("filum.pannelli.needle_holes_per_mm2")}>
              <b>{read.holes.toFixed(0)}</b>{t("filum.pannelli.holes_mm2")}
            </span>
            <span title={t("filum.pannelli.thread_added_to_the_fabric", { v1: f?.limits?.gsm ?? "?" })}>
              +<b>{read.added.toFixed(0)}</b>{t("filum.pannelli.g_m2")}
            </span>
            <span className={`dl-cls k${read.cls}`}>{CLASS_LABELS()[read.cls]}</span>
          </>
        ) : f && f.stats.area > 0 ? (
          <span className="stat">
            {t("filum.pannelli.peak_maxlayers_layers_maxholes_holes", { maxLayers: f.stats.maxLayers.toFixed(1), maxHoles: f.stats.maxHoles.toFixed(0), meanAdded: f.stats.meanAdded.toFixed(0) })}</span>
        ) : null}
      </div>
      {f && f.stats.area > 0 && (
        <div className={`dl-hot ${spots.length ? "bad" : "good"}`}>
          {spots.length ? (
            <>
              <AlertTriangle size={13} />
              <span>
                {tn("filum.pannelli.n_places_too_dense_for", spots.length, { fabric: fab.label.toLowerCase() })}
                {hot >= 0 && spots[hot] && (
                  <span className="stat">
                    {" "}
                    · {hot + 1}/{spots.length}: {spots[hot].objects.map((i) => objects[i]?.name).filter(Boolean).slice(0, 3).join(", ")}
                  </span>
                )}
              </span>
              {stacked && (
                <button
                  className="btn sm primary"
                  title={t("filum.pannelli.fills_stack_on_top_of")}
                  onClick={() => useStore.getState().commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), removeOverlaps: true } }))}
                >
                  {t("filum.pannelli.remove_hidden")}
                </button>
              )}
              <button className="btn sm" onClick={() => showHot((hot + 1) % spots.length)} title={t("filum.pannelli.zoom_to_the_next_place")}>
                {hot < 0 ? t("filum.pannelli.show") : t("filum.pannelli.next")} <ChevronRight size={12} />
              </button>
            </>
          ) : (
            <>
              <Check size={13} />
              <span>{t("filum.pannelli.nothing_beyond_what_label_takes", { label: fab.label.toLowerCase() })}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
