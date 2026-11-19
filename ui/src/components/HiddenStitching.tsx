// Hidden stitching: the design-wide panel (whether stitching under objects on
// top is left out, what counts as hiding it, what gets removed, and which
// objects are cut) and each object's own setting in the selection.

import { t, tn } from "../nova/i18n/filum";
import { Check, Eye, EyeOff, RotateCcw, Scissors, Sparkles } from "lucide-react";
import { StitchFill, StitchRunning, StitchSatin, Underlay } from "../icons/stitch";
import { defaultDesignOptions } from "../lib/geometry";
import { RULE_DEFAULTS, coverVerdict, hiddenOptions, suggestedOverlap, useHiddenReport, type HiddenReport } from "../lib/hiddenStitching";
import { fabricInfo } from "../lib/materials";
import { useStore } from "../store";
import type { CoverMode, DesignObject, DesignOptions } from "../types";
import { Num, Row, Section, Toggle } from "./ui";

const setOptions = (p: Partial<DesignOptions>) => useStore.getState().commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), ...p } }));
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

const TYPE_ICON = { fill: StitchFill, satin: StitchSatin, running: StitchRunning } as Record<string, typeof StitchFill | undefined>;

/** Design ▸ Hidden stitching. */
export function HiddenStitchingSection() {
  const doc = useStore((s) => s.doc);
  const show = useStore((s) => s.showHidden);
  const o = hiddenOptions(doc.options);
  const report = useHiddenReport();
  const fabric = fabricInfo(doc.fabric);
  const sug = suggestedOverlap(doc.fabric);
  const overrides = doc.objects.map((x, i) => ({ x, i })).filter(({ x }) => x.hidden && (x.hidden.keep || (x.hidden.covers && x.hidden.covers !== "auto")));
  const changed = (Object.keys(RULE_DEFAULTS) as (keyof DesignOptions)[]).some((k) => o[k as keyof typeof o] !== RULE_DEFAULTS[k]);
  return (
    <Section
      title={t("filum.pannelli.hidden_stitching")}
      extra={<Toggle on={o.removeOverlaps} title={t("filum.pannelli.leave_out_stitching_hidden_under")} onChange={(v) => setOptions({ removeOverlaps: v })} />}
    >
      {!o.removeOverlaps ? (
        <p className="hint hs-off">
          {t("filum.pannelli.everything_is_sewn_also_where")}
        </p>
      ) : (
        <>
          <Summary report={report} show={show} />

          <h6 className="hs-sub">{t("filum.pannelli.overlap")}</h6>
          <Row label={t("filum.pannelli.under_the_top")} title={t("filum.pannelli.how_far_a_cut_fill")}>
            <Num value={o.overlapMargin} unit="mm" step={0.1} min={0} max={3} onChange={(v) => setOptions({ overlapMargin: v })} />
          </Row>
          {Math.abs(o.overlapMargin - sug.value) > 0.05 && (
            <button className="hs-suggest" onClick={() => setOptions({ overlapMargin: sug.value })} title={t("filum.pannelli.the_overlap_practitioners_suggest_for", { v1: fabric.label.toLowerCase(), why: sug.why })}>
              <Sparkles size={11} /> {t("filum.pannelli.value_mm_suggested_for", { value: sug.value, fabric: fabric.label.toLowerCase() })}
            </button>
          )}

          <h6 className="hs-sub">{t("filum.pannelli.what_hides_stitching")}</h6>
          <Row label={t("filum.pannelli.narrowest")} title={t("filum.pannelli.an_object_only_hides_what")}>
            <Num value={o.coverMinWidth} unit="mm" step={0.5} min={0} max={10} onChange={(v) => setOptions({ coverMinWidth: v })} />
          </Row>
          <Row label={t("filum.pannelli.rows_up_to")} title={t("filum.pannelli.fills_and_satins_with_rows")}>
            <Num value={o.coverMaxSpacing} unit="mm" step={0.1} min={0} max={5} onChange={(v) => setOptions({ coverMaxSpacing: v })} />
          </Row>
          <Row label={t("filum.pannelli.textures")} title={t("filum.pannelli.stipple_meander_hilbert_and_cross")}>
            <Toggle on={o.texturedCovers} onChange={(v) => setOptions({ texturedCovers: v })} />
          </Row>
          <Row label={t("filum.pannelli.applique_fabric")} title={t("filum.pannelli.the_fabric_of_an_applique")}>
            <Toggle on={o.appliqueCovers} onChange={(v) => setOptions({ appliqueCovers: v })} />
          </Row>

          <h6 className="hs-sub">{t("filum.pannelli.what_is_removed")}</h6>
          <p className="hs-note">
            <StitchFill size={12} />{t("filum.pannelli.fills_under_anything_that_hides")}
          </p>
          <Row label={t("filum.pannelli.running_stitch")} title={t("filum.pannelli.lines_under_an_object_that")}>
            <Toggle on={o.trimRunning} onChange={(v) => setOptions({ trimRunning: v })} />
          </Row>
          <Row label={t("filum.pannelli.underlay")} title={t("filum.pannelli.kept_the_cut_fill_s")}>
            <div className="seg hs-seg">
              <button className={!o.keepUnderlay ? "on" : ""} onClick={() => setOptions({ keepUnderlay: false })}>
                {t("filum.pannelli.cut_too")}
              </button>
              <button className={o.keepUnderlay ? "on" : ""} onClick={() => setOptions({ keepUnderlay: true })}>
                <Underlay size={12} />{t("filum.pannelli.kept")}
              </button>
            </div>
          </Row>
          <Row label={t("filum.pannelli.smallest_piece")} title={t("filum.pannelli.leftover_pieces_smaller_than_this")}>
            <Num value={o.minFragment} unit="mm²" step={1} min={0} max={100} digits={1} onChange={(v) => setOptions({ minFragment: v })} />
          </Row>
          {changed && (
            <button className="btn sm ghost hs-reset" onClick={() => setOptions(RULE_DEFAULTS)}>
              <RotateCcw size={12} />{t("filum.pannelli.default_rules")}
            </button>
          )}

          <h6 className="hs-sub">{t("filum.pannelli.objects_2")}</h6>
          <ObjectList report={report} />
          {overrides.length > 0 && (
            <div className="hs-overrides">
              <p className="hs-note">{t("filum.pannelli.set_by_hand")}</p>
              {overrides.map(({ x }) => (
                <button key={x.id} className="hs-chip" onClick={() => useStore.getState().select([x.id])} title={t("filum.pannelli.select_it_its_own_setting")}>
                  <i style={{ background: doc.threads.find((t) => t.id === x.thread)?.color }} />
                  {x.name}
                  <span>{[x.hidden?.covers === "always" ? "always hides" : x.hidden?.covers === "never" ? "never hides" : "", x.hidden?.keep ? "keeps its stitches" : ""].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function Summary({ report, show }: { report: HiddenReport | null; show: boolean }) {
  const saved = report ? report.before - report.after : 0;
  const gone = report?.objects.filter((x) => x.gone).length ?? 0;
  return (
    <div className={`hs-summary ${report && saved === 0 ? "none" : ""}`}>
      <div className="hs-big">
        {report == null ? (
          <span className="hs-wait">{t("filum.pannelli.working_it_out")}</span>
        ) : saved > 0 ? (
          <>
            <b>−{saved.toLocaleString()}</b>{t("filum.pannelli.stitches_2")}<span className="hs-pct">{pctOf(saved, report.before)} %</span>
          </>
        ) : (
          <span>{t("filum.pannelli.nothing_is_hidden_under_other")}</span>
        )}
      </div>
      {report && saved > 0 && (
        <div className="hs-bar" title={t("filum.pannelli.v1_of_v2_stitches_are", { v1: report.after.toLocaleString(), v2: report.before.toLocaleString() })}>
          <i style={{ width: `${100 - pctOf(saved, report.before)}%` }} />
        </div>
      )}
      <div className="hs-meta">
        {report && saved > 0 && (
          <span>
            {tn("filum.pannelli.n_objects_cut", report.objects.length)}{gone ? t("filum.pannelli.gone_left_out_completely", { gone }) : ""}
          </span>
        )}
        <button className={`hs-show ${show ? "on" : ""}`} onClick={() => useStore.getState().set({ showHidden: !show })} title={t("filum.pannelli.mark_what_is_left_out")}>
          {show ? <Eye size={12} /> : <EyeOff size={12} />}{t("filum.pannelli.show_on_canvas")}
        </button>
      </div>
    </div>
  );
}

/** The objects that lose stitches, most first; each can keep its stitches. */
function ObjectList({ report }: { report: HiddenReport | null }) {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  if (!report) return null;
  if (!report.objects.length) return <p className="hs-note">{t("filum.pannelli.no_object_loses_stitches")}</p>;
  return (
    <ul className="hs-list">
      {report.objects.map((r) => {
        const o = doc.objects[r.index];
        if (!o) return null;
        const Icon = TYPE_ICON[o.stitch.type];
        const cut = r.before - r.after;
        return (
          <li key={o.id} className={selection.includes(o.id) ? "on" : ""}>
            <button className="hs-obj" onClick={() => useStore.getState().select([o.id])} title={t("filum.pannelli.select_name", { name: o.name })}>
              <i className="hs-sw" style={{ background: doc.threads.find((t) => t.id === o.thread)?.color }} />
              {Icon && <Icon size={12} />}
              <span className="hs-name">{o.name}</span>
              <span className="hs-cut">{r.gone ? t("filum.pannelli.left_out_2") : `−${cut.toLocaleString()}`}</span>
              <span className="hs-mini" aria-hidden>
                <i style={{ width: `${pctOf(cut, r.before)}%` }} />
              </span>
            </button>
            <button
              className="icon-btn hs-keep"
              title={t("filum.pannelli.keep_all_of_name_s", { name: o.name })}
              onClick={() => useStore.getState().updateObject(o.id, { hidden: { ...o.hidden, keep: true } })}
            >
              <Check size={12} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Selection ▸ Hidden stitching: one object's part in it. */
export function ObjectHiddenSection({ o }: { o: DesignObject }) {
  const doc = useStore((s) => s.doc);
  const opts = hiddenOptions(doc.options);
  const report = useHiddenReport();
  const index = doc.objects.indexOf(o);
  const mine = report?.objects.find((x) => x.index === index);
  const st = o.stitch.type;
  const canCover = st === "fill" || st === "satin" || st === "applique";
  const canBeCut = st === "fill" || (st === "running" && opts.trimRunning);
  if (!canCover && st !== "running") return null;
  const mode: CoverMode = o.hidden?.covers ?? "auto";
  const verdict = coverVerdict(o, doc.options);
  const set = (h: Partial<NonNullable<DesignObject["hidden"]>>) => {
    const next = { ...o.hidden, ...h };
    const empty = (next.covers ?? "auto") === "auto" && !next.keep;
    useStore.getState().updateObject(o.id, { hidden: empty ? undefined : next });
  };
  return (
    <Section title={t("filum.pannelli.hidden_stitching")} defaultOpen={!!o.hidden || !!mine}>
      {!opts.removeOverlaps && (
        <p className="hint hs-off">
          {t("filum.pannelli.hidden_stitching_is_sewn_in")}{" "}
          <button className="btn sm" onClick={() => setOptions({ removeOverlaps: true })}>
            {t("filum.pannelli.leave_it_out")}
          </button>
        </p>
      )}
      {canCover && (
        <>
          <Row label={t("filum.pannelli.hides")} title={t("filum.pannelli.whether_stitching_under_this_object")}>
            <div className="seg hs-seg">
              {(["auto", "always", "never"] as const).map((m) => (
                <button key={m} className={mode === m ? "on" : ""} onClick={() => set({ covers: m })}>
                  {m === "auto" ? t("filum.pannelli.hides_auto") : m === "always" ? t("filum.pannelli.always") : t("filum.pannelli.never")}
                </button>
              ))}
            </div>
          </Row>
          <p className={`hs-verdict ${verdict.hides}`}>
            {verdict.hides === "no" ? <EyeOff size={11} /> : <Eye size={11} />} {verdict.why}
          </p>
        </>
      )}
      {(canBeCut || o.hidden?.keep) && (
        <Row label={t("filum.pannelli.keep_its_stitches")} title={t("filum.pannelli.sew_this_object_whole_also")}>
          <Toggle on={!!o.hidden?.keep} onChange={(v) => set({ keep: v })} />
        </Row>
      )}
      {opts.removeOverlaps && canBeCut && !o.hidden?.keep && (
        <p className="hs-note">
          <Scissors size={11} />{" "}
          {mine
            ? mine.gone
              ? t("filum.pannelli.hidden_completely_it_is_left")
              : t("filum.pannelli.v1_of_its_v2_stitches", { v1: (mine.before - mine.after).toLocaleString(), v2: mine.before.toLocaleString(), v3: pctOf(mine.before - mine.after, mine.before) })
            : report
              ? t("filum.pannelli.nothing_on_top_hides_it")
              : t("filum.pannelli.working_it_out")}
        </p>
      )}
    </Section>
  );
}
