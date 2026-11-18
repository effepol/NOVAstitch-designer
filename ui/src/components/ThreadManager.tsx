// Thread manager: the colour sequence (sew order), the design's threads with
// usage and chart matching, a thread chart browser, and bulk tools (match to
// chart, merge similar, remove unused, sort, import / export palettes).

import { ArrowDownUp, Check, ChevronDown, ChevronUp, Copy, Crosshair, Download, Link2, ListPlus, Lock, RotateCcw, Search, Trash2, Undo2, Unlock, Upload, Replace, X } from "lucide-react";
import { SewOrder, Spool } from "../icons/stitch";
import { THREAD_WEIGHTS } from "../lib/materials";
import { MatchButton, useMatchOptions } from "./MatchPanel";
import { quality as qualityOf, type MatchCandidate } from "../lib/threadMatch";
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeOrder } from "../lib/actions";
import {
  assignChart,
  chartLabel,
  colorSequence,
  colourEdit,
  deleteThread,
  deltaE,
  lab,
  deltaLabel,
  duplicateThread,
  exportPalette,
  importPalette,
  inkOn,
  mergeSimilarColours,
  mergeTolerance,
  setMergeTolerance,
  mergeThreads,
  moveThread,
  nearest,
  normHex,
  removeUnused,
  sortBySewOrder,
  threadUsage,
  updateThread,
  addDesignThreadsToMine,
  clearMyThreads,
  exportMyThreads,
  fitSequence,
  fitTargetId,
  fitThreads,
  myLines,
  needOf,
  parseFitTarget,
  revertFit,
  isLocked,
  threadCandidates,
  toggleLock,
  spoolKey,
  importMyThreads,
  MY_CHART,
  ownedKey,
  removeMyThread,
  toggleMyThread,
  useMyThreads,
  type ChartEntry,
  type FitReport,
  type FitTarget,
} from "../lib/threads";
import { useStore } from "../store";
import type { Thread, ThreadSource } from "../types";
import { ChartBrowser, lastChart, setLastChart, threadTitle, useChart } from "./ThreadPicker";
import { Dialog, Num } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t, tn } from "../nova/i18n/filum";

const fmtK = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());

/**
 * The sew order: one block per colour change (width ∝ stitches), the spool
 * sewn on top and, underneath, the original colours (needs) it carries —
 * several needs in one block are threads fitted or merged onto one spool.
 */
export function FitStrip({ onPick, active }: { onPick?: (threadId: string) => void; active?: string | null }) {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const blocks = useMemo(() => fitSequence(doc, plan), [doc, plan]);
  const total = blocks.reduce((a, b) => a + b.stitches, 0) || 1;
  const fitted = Object.keys(doc.threadSources ?? {}).length > 0;
  const showNeeds = fitted || blocks.some((b) => b.needs.length > 1);
  if (!blocks.length) return <div className="seq-strip empty">{t("filum.finestre.no_stitches_yet")}</div>;
  return (
    <div className={`fit-strip ${showNeeds ? "two" : ""}`}>
      {showNeeds && (
        <div className="fs-labels">
          <span>{t("filum.finestre.sewn")}</span>
          <span>{t("filum.finestre.needs")}</span>
        </div>
      )}
      <div className="fs-blocks">
        {blocks.map((b) => {
          const on = !!active && (b.threadId === active || b.needs.some((n) => n.threadId === active));
          return (
            <div key={b.index} className={`fs-block ${on ? "on" : ""}`} style={{ flexGrow: Math.max(0.6, (b.stitches / total) * blocks.length) }}>
              <button
                type="button"
                className="fs-spool"
                style={{ background: b.thread.color, color: inkOn(b.thread.color) }}
                title={`${b.index + 1}. ${threadTitle(b.thread)}${t("filum.finestre.block_stats", { stitches: b.stitches.toLocaleString(), metres: b.metres.toFixed(1) })}${b.needs.length > 1 ? t("filum.finestre.length_threads_on_this_spool", { length: b.needs.length }) : ""}`}
                onClick={() => b.threadId && onPick?.(b.threadId)}
              >
                {b.index + 1}
                {b.needs.length > 1 && (
                  <i className="fs-merged">
                    <Link2 size={10} />
                    {b.needs.length}
                  </i>
                )}
              </button>
              {showNeeds && (
                <span className="fs-needs">
                  {b.needs.map((n, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`${n.threadId === active ? "on" : ""} ${n.d > 6 ? "far" : ""}`}
                      style={{ flexGrow: n.stitches, background: n.need.color }}
                      title={t("filum.finestre.needs_v1_v2_sewn_with", { v1: [n.need.name, n.need.brand, n.need.code].filter(Boolean).join(" "), v2: n.need.color.toUpperCase(), v3: threadTitle(b.thread), v4: n.d.toFixed(1), v5: deltaLabel(n.d) })}
                      onClick={() => onPick?.(n.threadId)}
                    />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThreadRow({
  t: th,
  index,
  count,
  selected,
  usage,
  match,
  others,
  onSelect,
  matchLabel = "chart",
  need,
  shared,
  locked,
}: {
  locked?: boolean;
  matchLabel?: string;
  /** The original colour, when the thread is fitted. */
  need?: ThreadSource;
  /** Other threads on the same spool. */
  shared?: number;
  t: Thread;
  index: number;
  count: number;
  selected: boolean;
  usage: { objects: number; stitches: number; metres: number; blocks: number[] };
  match: (ChartEntry & { d: number }) | null;
  others: Thread[];
  onSelect: () => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  // the thread when its colour editing began: brand and code come back if the colour does
  const editFrom = useRef<Thread | null>(null);
  // the catalogue colour of the thread's spool (the chart's, when the chart has its code)
  const spoolColor = (from: Thread) => (match && from.code && match.code === from.code ? match.color : from.color);
  const [hex, setHex] = useState(th.color.toUpperCase());
  useEffect(() => setHex(th.color.toUpperCase()), [th.color]);
  const used = usage.objects > 0;
  const exact = match && match.d < 0.5 && (th.code === match.code || !th.code);
  return (
    <div className={`tm-row ${selected ? "on" : ""}`} onClick={onSelect}>
      <button
        type="button"
        className="tm-swatch"
        style={{ background: th.color, color: inkOn(th.color) }}
        title={t("filum.finestre.edit_colour")}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
          useStore.getState().checkpoint();
          editFrom.current = th;
          colorRef.current?.click();
        }}
      >
        {usage.blocks.length ? usage.blocks.slice(0, 3).join(" ") : ""}
        <input
          ref={colorRef}
          type="color"
          value={th.color}
          onChange={(e) => {
            const from = editFrom.current ?? th;
            updateThread(th.id, colourEdit(from, e.target.value, spoolColor(from)), true);
          }}
          tabIndex={-1}
        />
      </button>
      <div className="tm-main">
        <input className="input tm-name" defaultValue={th.name} key={th.name} onBlur={(e) => e.target.value !== th.name && updateThread(th.id, { name: e.target.value })} />
        <div className="tm-meta">
          <input
            className="input mono tm-hex"
            value={hex}
            spellCheck={false}
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => {
              const h = normHex(hex);
              if (h && h !== th.color) updateThread(th.id, colourEdit(th, h, spoolColor(th)));
              else setHex(th.color.toUpperCase());
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <input className="input tm-brand" placeholder={t("filum.finestre.brand")} defaultValue={th.brand} key={`b${th.brand}`} onBlur={(e) => e.target.value !== th.brand && updateThread(th.id, { brand: e.target.value })} />
          <input className="input tm-code" placeholder={t("filum.finestre.code")} defaultValue={th.code} key={`c${th.code}`} onBlur={(e) => e.target.value !== th.code && updateThread(th.id, { code: e.target.value })} />
          <select
            className="input tm-weight"
            value={th.weight ?? ""}
            title={t("filum.finestre.thread_weight_a_heavier_or")}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateThread(th.id, { weight: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{t("filum.finestre.wt")}</option>
            {THREAD_WEIGHTS.map((w) => (
              <option key={w.weight} value={w.weight}>
                {w.weight}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="tm-usage">
        {used ? (
          <>
            <b>{fmtK(usage.stitches)}</b>{t("filum.finestre.st")}{usage.metres.toFixed(1)}{t("filum.finestre.m")}
            <span className="stat">
              {tn("filum.finestre.n_objects", usage.objects)}
            </span>
          </>
        ) : (
          <span className="stat">{t("filum.finestre.unused")}</span>
        )}
      </div>
      <div className="tm-match">
        {need ? (
          <span className="tm-fit" title={t("filum.finestre.originally_v1_v2", { v1: [need.name, need.brand, need.code].filter(Boolean).join(" "), v2: need.color.toUpperCase() })}>
            <i style={{ background: need.color }} />
            <span className="stat">→</span>
            <b className={`q-${qualityOf(deltaE(lab(need.color), lab(th.color)))}`} title={t("filum.finestre.v1_match", { v1: qualityOf(deltaE(lab(need.color), lab(th.color))) })}>
              {t("filum.finestre.e_n", { n: deltaE(lab(need.color), lab(th.color)).toFixed(1) })}
            </b>
            {!!shared && (
              <span className="badge" title={tn("filum.finestre.more_threads_on_spool", shared)}>
                <Link2 size={10} /> {shared + 1}
              </span>
            )}
            <button
              type="button"
              className="icon-btn"
              title={t("filum.finestre.back_to_the_original_colour")}
              onClick={(e) => {
                e.stopPropagation();
                revertFit([th.id]);
              }}
            >
              <Undo2 size={12} />
            </button>
          </span>
        ) : (
          match &&
          (exact ? (
            <span className="badge ok" title={`${match.brand} ${match.code}`}>
              {matchLabel} ✓
            </span>
          ) : (
            <button
              type="button"
              className="tm-snap"
              title={t("filum.finestre.snap_to_brand_code_name", { brand: match.brand, code: match.code, name: match.name, v4: match.d.toFixed(1), v5: deltaLabel(match.d) })}
              onClick={(e) => {
                e.stopPropagation();
                assignChart(th.id, match);
              }}
            >
              <i style={{ background: match.color }} />
              {match.code} <span className="stat">{t("filum.finestre.e_d", { d: match.d.toFixed(1) })}</span>
            </button>
          ))
        )}
      </div>
      <div className="tm-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={`icon-btn ${locked ? "on" : ""}`} title={locked ? t("filum.finestre.locked_fitting_keeps_this_spool") : t("filum.finestre.lock_fitting_keeps_this_spool")} onClick={() => toggleLock(th.id)}>
          {locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          title={t("filum.finestre.select_its_objects")}
          disabled={!used}
          onClick={() => {
            const s = useStore.getState();
            s.select(s.doc.objects.filter((o) => o.thread === th.id).map((o) => o.id));
            s.set({ activeThread: th.id });
          }}
        >
          <Crosshair size={14} />
        </button>
        <button type="button" className="icon-btn" title={t("filum.finestre.move_up")} disabled={index === 0} onClick={() => moveThread(th.id, -1)}>
          <ChevronUp size={14} />
        </button>
        <button type="button" className="icon-btn" title={t("filum.finestre.move_down")} disabled={index === count - 1} onClick={() => moveThread(th.id, 1)}>
          <ChevronDown size={14} />
        </button>
        <button type="button" className="icon-btn" title={t("filum.finestre.duplicate")} onClick={() => duplicateThread(th.id)}>
          <Copy size={14} />
        </button>
        <select
          className="select tm-merge"
          value=""
          title={t("filum.finestre.merge_into_another_thread_its")}
          disabled={!others.length}
          onChange={(e) => e.target.value && mergeThreads([th.id], e.target.value)}
        >
          <option value="">{t("filum.finestre.merge")}</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="button" className="icon-btn" title={used ? t("filum.finestre.in_use_merge_it_into") : t("filum.finestre.delete")} disabled={used} onClick={() => deleteThread(th.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * My threads: the spools the user owns. Add them from any chart (click to
 * own / un-own), import or export a palette, then fit the design to them.
 */
function MyThreadsPanel({ selected }: { selected: Thread | null }) {
  const mine = useMyThreads();
  const doc = useStore((s) => s.doc);
  const toast = useStore.getState().toast;
  const [mode, setMode] = useState<"collection" | "add">(() => (mine.length ? "collection" : "add"));
  const [q, setQ] = useState("");
  const entries = useChart(MY_CHART);
  const inDesign = useMemo(() => new Set(doc.threads.map(ownedKey)), [doc.threads]);
  const closest = useMemo(() => (entries && selected ? nearest(entries, selected.color, 4) : []), [entries, selected]);
  const groups = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (t: (typeof mine)[number]) => words.every((w) => `${t.brand} ${t.name} ${t.code} ${t.color}`.toLowerCase().includes(w));
    const by = new Map<string, typeof mine>();
    for (const t of mine.filter(hit)) by.set(t.brand || "Other", [...(by.get(t.brand || "Other") ?? []), t]);
    return [...by].sort((a, b) => a[0].localeCompare(b[0]));
  }, [mine, q]);
  return (
    <div className="mine">
      <div className="mine-head">
        <div className="seg">
          <button className={mode === "collection" ? "on" : ""} onClick={() => setMode("collection")}>
            {t("filum.finestre.my_collection_mine", { mine: mine.length })}
          </button>
          <button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>
            <ListPlus size={13} />{t("filum.finestre.add_from_charts")}
          </button>
        </div>
        <div className="spacer" />
        <button
          className="icon-btn"
          title={t("filum.finestre.add_the_design_s_threads")}
          disabled={!doc.threads.length}
          onClick={() => {
            const n = addDesignThreadsToMine();
            toast(n ? tn("filum.finestre.added_threads_to_my", n) : t("filum.finestre.they_are_all_in_my"));
          }}
        >
          <Spool size={14} />
        </button>
        <button className="icon-btn" title={t("filum.finestre.import_spools_from_a_gpl")} onClick={async () => toast(t("filum.finestre.added_v1_spools", { v1: await importMyThreads() }))}>
          <Upload size={14} />
        </button>
        <button className="icon-btn" title={t("filum.finestre.export_my_threads_as_a")} disabled={!mine.length} onClick={() => exportMyThreads()}>
          <Download size={14} />
        </button>
        <button className="icon-btn" title={t("filum.finestre.remove_every_spool_from_my")} disabled={!mine.length} onClick={() => window.confirm(t("filum.finestre.remove_all_length_spools_from", { length: mine.length })) && clearMyThreads()}>
          <Trash2 size={14} />
        </button>
      </div>

      {mode === "add" ? (
        <>
          <p className="hint">{t("filum.finestre.click_the_colours_you_own")}</p>
          <ChartBrowser markOwned near={selected?.color} height={290} onPick={(e) => toggleMyThread({ name: e.name, code: e.code, brand: e.brand, color: e.color })} />
        </>
      ) : !mine.length ? (
        <div className="mine-empty">
          <b>{t("filum.finestre.no_spools_yet")}</b>
          <span>{t("filum.finestre.add_the_threads_you_own")}</span>
          <div className="dz-inline">
            <button className="btn sm primary" onClick={() => setMode("add")}>
              <ListPlus size={13} />{t("filum.finestre.add_from_charts")}
            </button>
            <button className="btn sm" disabled={!doc.threads.length} onClick={() => addDesignThreadsToMine()}>
              {t("filum.finestre.add_the_design_s_threads_2")}
            </button>
            <button className="btn sm" onClick={() => importMyThreads()}>
              {t("filum.finestre.import_gpl")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {selected && closest.length > 0 && (
            <div className="chart-near">
              <span className="chart-cap">{t("filum.finestre.closest_for_name", { name: selected.name })}</span>
              {closest.map((e) => (
                <button key={ownedKey(e)} type="button" className="chart-near-item" title={`${e.brand} ${e.code} ${e.name} · ΔE ${e.d.toFixed(1)} (${deltaLabel(e.d)})`} onClick={() => assignChart(selected.id, e)}>
                  <i style={{ background: e.color }} />
                  <span>{e.d.toFixed(1)}</span>
                </button>
              ))}
            </div>
          )}
          <label className="chart-search">
            <Search size={13} />
            <input className="input" placeholder={t("filum.finestre.search_length_spools", { length: mine.length })} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="mine-list">
            {groups.map(([brand, list]) => (
              <div key={brand}>
                <div className="cm-head">
                  {brand} · {list.length}
                </div>
                {list.map((th) => (
                  <div
                    key={ownedKey(th)}
                    className="mine-row"
                    role="button"
                    tabIndex={0}
                    title={selected ? t("filum.finestre.give_name_this_spool", { name: selected.name }) : t("filum.finestre.select_a_design_thread_to")}
                    onClick={() => (selected ? assignChart(selected.id, { ...th, lab: [0, 0, 0] }) : toast(t("filum.finestre.select_a_thread_first")))}
                  >
                    <i style={{ background: th.color }} />
                    <span className="mr-name">{th.name}</span>
                    <span className="stat mono">{th.code}</span>
                    {inDesign.has(ownedKey(th)) && <span className="badge ok">{t("filum.finestre.in_design")}</span>}
                    <button
                      className="icon-btn"
                      title={t("filum.finestre.remove_from_my_threads")}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMyThread(th);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {!groups.length && <p className="hint">{t("filum.finestre.no_spool_matches_q", { q })}</p>}
          </div>
        </>
      )}
    </div>
  );
}

/** The best spools of the fit target for the selected thread, with what changes. */
function CandidateStrip({ target, thread, matchKey }: { target: FitTarget; thread: Thread; matchKey: string }) {
  const doc = useStore((s) => s.doc);
  const [cands, setCands] = useState<MatchCandidate[] | null>(null);
  const need = needOf(doc, thread);
  useEffect(() => {
    let live = true;
    threadCandidates(target, thread.id, 5).then((c) => live && setCands(c));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTargetId(target), thread.id, need.color, matchKey]);
  if (!cands?.length) return null;
  const sign = (v: number, unit: string) => `${v > 0 ? "+" : ""}${v.toFixed(0)}${unit}`;
  return (
    <div className="tm-cands">
      <span className="tm-cands-need" title={t("filum.finestre.name_v2_the_colour_wanted", { name: need.name, v2: need.color.toUpperCase() })}>
        <i style={{ background: need.color }} />
        <b>{need.name}</b>
      </span>
      {cands.map((c) => {
        const on = spoolKey(c.entry) === spoolKey(thread);
        return (
          <button
            key={spoolKey(c.entry)}
            className={`tm-cand ${on ? "on" : ""}`}
            title={t("filum.finestre.v1_e_v2_v3_hue", { v1: [c.entry.brand, c.entry.code, c.entry.name].filter(Boolean).join(" "), v2: c.d.toFixed(1), v3: qualityOf(c.d), v4: sign(c.hue, "°"), v5: sign(c.chroma * 100, "%"), v6: sign(c.lightness, "") })}
            onClick={() => assignChart(thread.id, c.entry)}
          >
            <i style={{ background: c.entry.color }} />
            <span className="tc-code">{c.entry.code || c.entry.name}</span>
            <b className={`q-${qualityOf(c.d)}`}>{c.d.toFixed(1)}</b>
            <span className="stat">
              {Math.abs(c.hue) >= 3 ? sign(c.hue, "°") : ""} {Math.abs(c.chroma) >= 0.05 ? sign(c.chroma * 100, "%") : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ThreadManager({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const activeThread = useStore((s) => s.activeThread);
  const [sel, setSel] = useState<string | null>(activeThread ?? doc.threads[0]?.id ?? null);
  const [chart, setChart] = useState(lastChart);
  const [similar, setSimilarState] = useState(mergeTolerance);
  const setSimilar = (v: number) => {
    setSimilarState(v);
    setMergeTolerance(v);
  };
  const [side, setSide] = useState<"charts" | "mine">(() => (localStorage.getItem("filum.tm.side") === "mine" ? "mine" : "charts"));
  const pickSide = (v: "charts" | "mine") => {
    setSide(v);
    safeSetItem("filum.tm.side", v);
  };
  const mineCount = useMyThreads().length;
  const chartEntries = useChart(chart);
  const mineEntries = useChart(MY_CHART);
  const entries = side === "mine" ? mineEntries : chartEntries;
  const usage = useMemo(() => threadUsage(doc, plan), [doc, plan]);
  const seq = colorSequence(doc, plan);
  const changes = Math.max(0, seq.length - 1);
  const metres = seq.reduce((a, b) => a + b.metres, 0);
  const selected = doc.threads.find((t) => t.id === sel) ?? null;
  const toast = useStore.getState().toast;
  const matches = useMemo(() => new Map(entries ? doc.threads.map((t) => [t.id, nearest(entries, t.color, 1)[0] ?? null]) : []), [entries, doc.threads]);
  // fitting
  const mine = useMyThreads();
  const lines = useMemo(() => myLines(mine), [mine]);
  const [target, setTargetState] = useState<string>(() => localStorage.getItem("filum.tm.fit") ?? "mine");
  const setTarget = (v: string) => {
    setTargetState(v);
    safeSetItem("filum.tm.fit", v);
  };
  const fitTarget: FitTarget = parseFitTarget(target).kind === "chart" ? { kind: "chart", chart } : parseFitTarget(target);
  const [report, setReport] = useState<FitReport | null>(null);
  const [match, setMatch] = useMatchOptions();
  const sources = doc.threadSources ?? {};
  const fittedIds = doc.threads.filter((t) => sources[t.id]).map((t) => t.id);
  const quality = useMemo(() => {
    const ds = doc.threads.filter((t) => sources[t.id]).map((t) => deltaE(lab(sources[t.id].color), lab(t.color)));
    return ds.length ? { mean: ds.reduce((a, b) => a + b, 0) / ds.length, worst: Math.max(...ds) } : null;
  }, [doc.threads, sources]);
  const spoolCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of doc.threads) m.set(spoolKey(t), (m.get(spoolKey(t)) ?? 0) + 1);
    return m;
  }, [doc.threads]);
  const runFit = async (only?: string[]) => {
    const r = await fitThreads(fitTarget, { only, match });
    if (!r) return toast(fitTarget.kind === "mine" ? t("filum.finestre.no_spools_in_my_threads") : t("filum.finestre.the_chart_is_empty"), "info");
    setReport(r);
    toast(`${tn("filum.finestre.fitted_threads_to", r.fitted, { target: r.target })}${r.shared ? t("filum.finestre.shared_sharing_a_spool", { shared: r.shared }) : ""}`, "success");
  };
  return (
    <Dialog
      live
      title={t("filum.finestre.thread_colours_2")}
      onClose={onClose}
      xwide
      footer={
        <>
          <span className="tm-similar" title={t("filum.finestre.merge_threads_whose_colours_differ")}>
            <button
              className="btn"
              onClick={mergeSimilarColours}
            >
              {t("filum.finestre.merge_similar")}
            </button>
            <span className="stat">{t("filum.finestre.e_lt")}</span>
            <Num value={similar} min={1} max={30} step={1} digits={0} onChange={setSimilar} />
          </span>
          <button
            className="btn"
            onClick={() => {
              const n = removeUnused();
              toast(n ? tn("filum.finestre.removed_unused_threads", n) : t("filum.finestre.every_thread_is_in_use"));
            }}
          >
            {t("filum.finestre.remove_unused")}
          </button>
          <div className="spacer" />
          <button className="icon-btn" title={t("filum.finestre.import_a_gpl_palette_as")} onClick={async () => toast(t("filum.finestre.added_v1_threads", { v1: await importPalette() }))}>
            <Upload size={15} />
          </button>
          <button className="icon-btn" title={t("filum.finestre.export_the_threads_as_a")} onClick={() => exportPalette()}>
            <Download size={15} />
          </button>
          <button className="btn primary" onClick={onClose}>
            {t("filum.finestre.done")}
          </button>
        </>
      }
    >
      <div className="tm-top">
        <div className="tm-stats">
          <span>
            <b>{doc.threads.length}</b>{t("filum.finestre.threads_2")}
          </span>
          <span>
            <b>{seq.length}</b>{t("filum.finestre.colour_blocks")}
          </span>
          <span>
            <b>{changes}</b>{tn("filum.finestre.colour_change_word", changes)}
          </span>
          <span>
            <b>{metres.toFixed(1)}</b>{t("filum.finestre.m_top_thread")}
          </span>
          {fittedIds.length > 0 && (
            <span className="fitted">
              <b>{fittedIds.length}</b>{t("filum.finestre.fitted")}
            </span>
          )}
        </div>
        <button className="btn sm" title={t("filum.finestre.reorder_objects_to_minimise_colour")} onClick={optimizeOrder}>
          <SewOrder size={13} />{t("filum.finestre.optimise_stitch_order")}
        </button>
        <button className="btn sm ghost" title={t("filum.finestre.list_threads_in_the_order")} onClick={sortBySewOrder}>
          <ArrowDownUp size={13} />{t("filum.finestre.sort_by_sew_order")}
        </button>
      </div>
      <FitStrip active={sel} onPick={setSel} />
      <div className="tm-fitbar">
        <span className="tm-fit-label">{t("filum.finestre.fit_threads_to")}</span>
        <select className="select" value={target} onChange={(e) => setTarget(e.target.value)} title={t("filum.finestre.fit_to_all_your_spools")}>
          <optgroup label={t("filum.finestre.my_threads")}>
            <option value="mine">{t("filum.finestre.all_my_threads_mine", { mine: mine.length })}</option>
            {lines.map((b) => [
              <option key={b.brand} value={fitTargetId({ kind: "mine", brand: b.brand })}>
                {b.brand} ({b.count})
              </option>,
              ...(b.lines.length > 1 || b.lines[0]?.line !== b.brand
                ? b.lines.map((l) => (
                    <option key={l.line} value={fitTargetId({ kind: "mine", line: l.line })}>
                      {"\u00a0\u00a0\u00a0"}
                      {l.line} ({l.count})
                    </option>
                  ))
                : []),
            ])}
          </optgroup>
          <optgroup label={t("filum.finestre.chart")}>
            <option value="chart:">{t("filum.finestre.n_chart_on_the_right", { n: chartLabel(chart) })}</option>
          </optgroup>
        </select>
        <MatchButton target={fitTarget} opts={match} set={setMatch} />
        <button className="btn sm primary" disabled={!doc.threads.length} onClick={() => runFit()} title={t("filum.finestre.fit_every_unlocked_thread_with")}>
          <Replace size={13} />{t("filum.finestre.fit_all")}
        </button>
        <button className="btn sm" disabled={!selected} onClick={() => selected && runFit([selected.id])} title={t("filum.finestre.fit_only_the_selected_thread")}>
          {t("filum.finestre.fit_selected")}
        </button>
        <div className="spacer" />
        {quality && (
          <span className="tm-quality" title={t("filum.finestre.colour_difference_between_the_original")}>
            {t("filum.finestre.e_avg")}<b>{quality.mean.toFixed(1)}</b>{t("filum.finestre.worst")}<b className={quality.worst > 6 ? "far" : ""}>{quality.worst.toFixed(1)}</b>
          </span>
        )}
        <button className="btn sm ghost" disabled={!fittedIds.length} onClick={() => (revertFit(), setReport(null))} title={t("filum.finestre.all_threads_back_to_their")}>
          <RotateCcw size={13} />{t("filum.finestre.revert_all")}{fittedIds.length ? ` (${fittedIds.length})` : ""}
        </button>
      </div>
      {report && (
        <div className={`tm-report ${report.far.length ? "warn" : ""}`}>
          <button className="icon-btn" title={t("filum.finestre.close")} onClick={() => setReport(null)}>
            <X size={12} />
          </button>
          <span>
            <Check size={12} /> {report.fitted}{t("filum.finestre.fitted_to")}{report.target}{t("filum.finestre.e_avg_2")}{report.mean.toFixed(1)}
            {report.shared ? t("filum.finestre.shared_sharing_a_spool_sewn", { shared: report.shared }) : ""}
          </span>
          {report.merged.length > 0 && (
            <span className="tm-far">
              {t("filum.finestre.merged_colours")}{" "}
              {report.merged.map((m, i) => (
                <span key={i}>
                  {m.a} + {m.b} <b>{t("filum.finestre.e_d", { d: m.d.toFixed(1) })}</b>
                </span>
              ))}
              <span className="stat">{t("filum.finestre.use_distinct_or_lock_one")}</span>
            </span>
          )}
          {report.far.length > 0 && (
            <span className="tm-far">
              {t("filum.finestre.no_close_spool_e_gt")}{" "}
              {report.far.map((f, i) => (
                <span key={i}>
                  {f.name} → {f.spool} <b>{f.d.toFixed(1)}</b>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      {selected && <CandidateStrip target={fitTarget} thread={selected} matchKey={JSON.stringify(match)} />}
      <div className="tm-body">
        <div className="tm-list">
          {doc.threads.map((th, i) => (
            <ThreadRow
              key={th.id}
              t={th}
              index={i}
              count={doc.threads.length}
              selected={th.id === sel}
              usage={usage.get(th.id) ?? { objects: 0, stitches: 0, metres: 0, blocks: [] }}
              match={matches.get(th.id) ?? null}
              others={doc.threads.filter((x) => x.id !== th.id)}
              onSelect={() => setSel(th.id)}
              matchLabel={side === "mine" ? t("filum.finestre.owned") : t("filum.finestre.chart_2")}
              need={sources[th.id] ? needOf(doc, th) : undefined}
              locked={isLocked(doc, th.id)}
              shared={(spoolCount.get(spoolKey(th)) ?? 1) - 1}
            />
          ))}
          {!doc.threads.length && <p className="hint">{t("filum.finestre.no_threads_yet_pick_colours")}</p>}
        </div>
        <div className="tm-chart">
          <div className="seg seg-full tm-side">
            <button className={side === "charts" ? "on" : ""} onClick={() => pickSide("charts")}>
              {t("filum.finestre.thread_charts")}
            </button>
            <button className={side === "mine" ? "on" : ""} onClick={() => pickSide("mine")}>
              {t("filum.finestre.my_threads")}{mineCount ? ` · ${mineCount}` : ""}
            </button>
          </div>
          {side === "mine" ? (
            <MyThreadsPanel selected={selected} />
          ) : (
            <>
          <div className="tm-chart-head">
            {selected ? (
              <>
                <span className="tm-cur" style={{ background: selected.color }} />
                <span>
                  {t("filum.finestre.replace")}<b>{selected.name}</b>{t("filum.finestre.with_a_chart_colour")}
                </span>
              </>
            ) : (
              <span className="stat">{t("filum.finestre.select_a_thread_to_recolour")}</span>
            )}
          </div>
          <ChartBrowser
            chart={chart}
            onChart={(c) => {
              setChart(c);
              setLastChart(c);
            }}
            near={selected?.color}
            height={300}
            markOwned
            onPick={(e) => {
              if (selected) assignChart(selected.id, e);
              else toast(t("filum.finestre.select_a_thread_first"));
            }}
          />
          <p className="hint">{t("filum.finestre.checked_colours_are_in_my")}</p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
