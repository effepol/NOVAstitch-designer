// Calibrate a fabric: sew a swatch without pull compensation, measure it, and
// save what new objects on that fabric start from (lib/calibration).

import { ArrowLeft, ArrowRight, Check, Download, Ruler, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DesignView } from "../canvas/DesignView";
import { engine } from "../engine/client";
import { Fabric as FabricIcon, StitchFill, StitchSatin } from "../icons/stitch";
import {
  BAR_L,
  BAR_W,
  DISC,
  LAYOUT,
  PIECES,
  calibrate,
  calibrationFor,
  fieldKey,
  parseMm,
  saveCalibration,
  swatchDocument,
  type Direction,
  type Measurements,
  type PieceId,
} from "../lib/calibration";
import { MACHINES, machineById } from "../lib/machines";
import { FABRICS, fabricInfo } from "../lib/materials";
import { saveFile } from "../lib/platform";
import { useStore } from "../store";
import type { Fabric, FormatInfo, PlanData } from "../types";
import { Dialog } from "./ui";
import { t, tn, useLanguage } from "../nova/i18n/filum";

type Step = 0 | 1 | 2;
const STEPS = () => [t("filum.digitalizza.sew_the_swatch"), t("filum.digitalizza.measure_it"), t("filum.digitalizza.save")];
const mm = (v: number, sign = false) => `${sign && v > 0 ? "+" : ""}${v.toFixed(2).replace(/\.?0+$/, "") || "0"} mm`;

export function CalibrateDialog({ onClose }: { onClose: () => void }) {
  useLanguage();
  const doc = useStore((s) => s.doc);
  const fabricColor = useStore((s) => s.fabricColor);
  const [fabric, setFabric] = useState<Fabric>(doc.fabric);
  const saved = calibrationFor(fabric);
  const [step, setStep] = useState<Step>(0);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<{ id: PieceId; dir: Direction } | null>(null);
  const [applyHere, setApplyHere] = useState(false);
  const [, bump] = useState(0);

  // a fabric's saved measurements come back when it is picked again
  useEffect(() => {
    const m = calibrationFor(fabric)?.measured ?? {};
    setRaw(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)])));
  }, [fabric]);

  const swatch = useMemo(() => swatchDocument(fabric, doc.machine, doc.options?.threadWeight), [fabric, doc.machine, doc.options?.threadWeight]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  useEffect(() => {
    let live = true;
    engine
      .planDetached(swatch)
      .then((p) => live && setPlan(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [swatch]);

  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const hasMachine = MACHINES.some((m) => m.id === doc.machine.profile);
  const machine = machineById(hasMachine ? doc.machine.profile! : "doc");
  const [fmt, setFmt] = useState(() => (machine.formats[0] ?? localStorage.getItem("filum.format") ?? "pes"));
  useEffect(() => {
    engine.formats().then((f) => setFormats(f.filter((x) => x.machine && x.canWrite)));
  }, []);
  const download = async () => {
    try {
      const bytes = await engine.export(swatch, fmt);
      const path = await saveFile(`calibration-${fabric}.${fmt}`, bytes, [{ name: fmt.toUpperCase(), extensions: [fmt] }]);
      if (path !== null) useStore.getState().toast(t("filum.digitalizza.saved_the_v1_swatch", { v1: fabricInfo(fabric).label.toLowerCase() }), "success");
    } catch (e) {
      useStore.getState().toast(t("filum.digitalizza.the_swatch_couldn_t_be", { message: (e as Error).message }), "error");
    }
  };

  const measured: Measurements = useMemo(() => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, parseMm(v)]).filter(([, v]) => v != null)), [raw]);
  const result = useMemo(() => calibrate(measured), [measured]);
  const filled = Object.keys(measured).length;
  const info = fabricInfo(fabric);
  const affected = fabric === doc.fabric ? doc.objects.filter((o) => (o.stitch.type === "satin" && result.satin) || (o.stitch.type === "fill" && result.fill)).length : 0;

  const save = () => {
    const s = useStore.getState();
    saveCalibration({
      fabric,
      date: new Date().toISOString().slice(0, 10),
      measured,
      satin: result.satin ? { pullComp: result.satin.pullComp, pushComp: result.satin.pushComp } : undefined,
      fill: result.fill ? { pullComp: result.fill.pullComp, expand: result.fill.expand } : undefined,
    });
    if (applyHere && affected) {
      s.commit((d) => ({
        ...d,
        objects: d.objects.map((o) =>
          o.stitch.type === "satin" && result.satin
            ? { ...o, stitch: { ...o.stitch, pullComp: result.satin.pullComp, pushComp: result.satin.pushComp } }
            : o.stitch.type === "fill" && result.fill
              ? { ...o, stitch: { ...o.stitch, pullComp: result.fill.pullComp, expand: result.fill.expand } }
              : o,
        ),
      }));
    }
    s.toast(`${t("filum.digitalizza.label_calibrated", { label: info.label })}${applyHere && affected ? tn("filum.digitalizza.objects_updated", affected) : ""}`, "success");
    onClose();
  };
  const reset = () => {
    saveCalibration({ fabric, clear: true });
    setRaw({});
    bump((n) => n + 1);
    useStore.getState().toast(t("filum.digitalizza.label_is_back_to_the", { label: info.label }));
  };

  // a measurement far off (a typo like 250 for 25) would save extreme settings
  const canSave = !!(result.satin || result.fill) && !result.odd.length;
  return (
    <Dialog
      title={t("filum.digitalizza.calibrate_a_fabric")}
      wide
      onClose={onClose}
      footer={
        <>
          {saved && (
            <button className="btn ghost" onClick={reset} title={t("filum.digitalizza.forget_the_v1_calibration_new", { v1: info.label.toLowerCase() })}>
              <RotateCcw size={13} />{t("filum.digitalizza.standard_numbers")}
            </button>
          )}
          <div className="spacer" />
          {step > 0 && (
            <button className="btn" onClick={() => setStep((step - 1) as Step)}>
              <ArrowLeft size={13} />{t("filum.digitalizza.back")}
            </button>
          )}
          {step < 2 ? (
            <button className="btn primary" onClick={() => setStep((step + 1) as Step)}>
              {step === 0 ? t("filum.digitalizza.i_ve_sewn_it") : t("filum.digitalizza.see_the_result")} <ArrowRight size={13} />
            </button>
          ) : (
            <button className="btn primary" disabled={!canSave} onClick={save}>
              <Check size={13} />{t("filum.digitalizza.save_for")}{info.label}
            </button>
          )}
        </>
      }
    >
      <div className="cal-top">
        <p className="cal-intro">
          {t("filum.digitalizza.how_much_stitches_pull_depends")}
        </p>
        <label className="cal-fabric">
          <FabricIcon size={13} />
          <select className="select" value={fabric} onChange={(e) => setFabric(e.target.value as Fabric)}>
            {FABRICS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {calibrationFor(f.id) ? " ✓" : ""}
              </option>
            ))}
          </select>
          <span className={`cal-state ${saved ? "on" : ""}`}>{saved ? t("filum.digitalizza.calibrated_v1", { v1: new Date(saved.date).toLocaleDateString() }) : t("filum.digitalizza.standard_numbers_2")}</span>
        </label>
      </div>

      <ol className="cal-steps" role="tablist">
        {STEPS().map((t, i) => (
          <li key={t}>
            <button role="tab" aria-selected={step === i} className={`${step === i ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => setStep(i as Step)}>
              <span className="cal-dot">{i < step ? <Check size={11} /> : i + 1}</span>
              {t}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="cal-grid">
          <div className="cal-preview">
            <DesignView doc={swatch} plan={plan} mode="realistic" fabricColor={fabricColor} pad={14} />
            <span className="cal-size">{t("filum.digitalizza.n100_100_mm")}</span>
          </div>
          <div className="cal-side">
            <p className="cal-lead">{t("filum.digitalizza.four_pieces_with_label_s", { label: info.label.toLowerCase() })}</p>
            <ul className="cal-check">
              <li>
                <b>{t("filum.digitalizza.backing")}</b>{t("filum.digitalizza.the_one_you_always_use")}{info.backing.toLowerCase()}
              </li>
              <li>
                <b>{t("filum.digitalizza.topping")}</b> {info.topping.toLowerCase()}
              </li>
              <li>
                <b>{t("filum.digitalizza.needle")}</b> {info.needle}
              </li>
              <li>
                <b>{t("filum.digitalizza.hooping")}</b>{t("filum.digitalizza.as_you_hoop_real_designs")}
              </li>
            </ul>
            <div className="cal-download">
              <select className="select" value={fmt} onChange={(e) => setFmt(e.target.value)} title={t("filum.digitalizza.file_format_for_your_machine")}>
                {(formats.length ? formats : [{ extension: fmt, name: fmt.toUpperCase() } as FormatInfo]).map((f) => (
                  <option key={f.extension} value={f.extension} title={f.name}>
                    {f.extension.toUpperCase()}
                    {hasMachine && machine.formats.includes(f.extension) ? ` · ${machine.brand || machine.name}` : ""}
                  </option>
                ))}
              </select>
              <button className="btn primary" onClick={download}>
                <Download size={13} />{t("filum.digitalizza.download_swatch")}
              </button>
            </div>
            <p className="hint">{t("filum.digitalizza.it_uses_this_design_s")}</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="cal-grid">
          <SwatchDiagram focus={focus} measured={measured} />
          <div className="cal-side">
            <p className="cal-lead">
              <Ruler size={13} />{t("filum.digitalizza.with_a_ruler_or_calipers")}
            </p>
            <table className="cal-table">
              <thead>
                <tr>
                  <th />
                  <th title={t("filum.digitalizza.the_way_the_thread_lies")}>{t("filum.digitalizza.along_the_stitches")}</th>
                  <th title={t("filum.digitalizza.at_right_angles_to_the")}>{t("filum.digitalizza.across_them")}</th>
                </tr>
              </thead>
              <tbody>
                {PIECES.map((p) => (
                  <tr key={p.id} className={focus?.id === p.id ? "on" : ""}>
                    <th>
                      <span className="cal-letter">{p.letter}</span>
                      <span className="cal-pname">
                        {p.kind === "fill" ? <StitchFill size={12} /> : <StitchSatin size={12} />} {p.name}
                      </span>
                    </th>
                    {(["along", "across"] as const).map((d) => {
                      const k = fieldKey(p.id, d);
                      const v = measured[k];
                      const drawn = p[d];
                      const diff = v != null ? v - drawn : null;
                      return (
                        <td key={d}>
                          <label className={`cal-field ${diff != null && Math.abs(diff) > Math.max(1.5, drawn * 0.15) ? "odd" : ""}`}>
                            <input
                              className="input"
                              inputMode="decimal"
                              placeholder={drawn.toFixed(1)}
                              value={raw[k] ?? ""}
                              aria-label={d === "along" ? t("filum.digitalizza.letter_along_drawn", { letter: p.letter, drawn }) : t("filum.digitalizza.letter_across_drawn", { letter: p.letter, drawn })}
                              onFocus={() => setFocus({ id: p.id, dir: d })}
                              onBlur={() => setFocus(null)}
                              onChange={(e) => setRaw((r) => ({ ...r, [k]: e.target.value }))}
                            />
                            <span className="cal-unit">mm</span>
                          </label>
                          <span className={`cal-diff ${diff == null ? "" : diff < -0.04 ? "in" : diff > 0.04 ? "out" : "same"}`}>
                            {diff == null ? t("filum.digitalizza.drawn_drawn", { drawn }) : Math.abs(diff) < 0.05 ? t("filum.digitalizza.as_drawn") : mm(+diff.toFixed(2), true)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              {t("filum.digitalizza.a_disc_s_stitches_run")}
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="cal-result">
          {!(result.satin || result.fill) && (
            <p className="cal-empty">
              <Ruler size={14} />{t("filum.digitalizza.enter_at_least_one_disc")}{filled}{t("filum.digitalizza.of_8_so_far")}
            </p>
          )}
          <div className="cal-cards">
            <ResultCard
              icon={<StitchSatin size={15} />}
              title={t("filum.digitalizza.satin_columns")}
              empty={!result.satin}
              wasLabel={saved?.satin ? t("filum.digitalizza.before") : t("filum.digitalizza.standard")}
              rows={
                result.satin
                  ? [
                      {
                        label: t("filum.digitalizza.pull_compensation"),
                        value: mm(result.satin.pullComp),
                        was: saved?.satin?.pullComp ?? 0.2,
                        why: `Sewn ${mm(BAR_W - result.satin.shrink)} wide for ${BAR_W} drawn: the column is widened by that much in total.`,
                      },
                      {
                        label: t("filum.digitalizza.ends_pulled_in"),
                        value: mm(result.satin.pushComp),
                        was: saved?.satin?.pushComp ?? 0,
                        why: `Sewn ${mm(BAR_L + result.satin.grow)} long for ${BAR_L} drawn: each end starts that much further in.`,
                      },
                    ]
                  : []
              }
            />
            <ResultCard
              icon={<StitchFill size={15} />}
              title={t("filum.digitalizza.fills")}
              empty={!result.fill}
              wasLabel={saved?.fill ? t("filum.digitalizza.before") : t("filum.digitalizza.standard")}
              rows={
                result.fill
                  ? [
                      {
                        label: t("filum.digitalizza.pull_compensation"),
                        value: `${mm(result.fill.pullComp)} each side`,
                        was: saved?.fill?.pullComp ?? 0,
                        why: `Sewn ${mm(DISC - result.fill.shrink)} along the rows for ${DISC} drawn: every row reaches that much further.`,
                      },
                      {
                        label: t("filum.digitalizza.shape"),
                        value: result.fill.expand ? `${mm(Math.abs(result.fill.expand))} ${result.fill.expand < 0 ? "smaller" : "larger"} each side` : "as drawn",
                        was: saved?.fill?.expand ?? 0,
                        why: `Sewn ${mm(DISC + result.fill.grow)} across the rows for ${DISC} drawn: the shape is ${result.fill.expand < 0 ? "stitched smaller" : result.fill.expand > 0 ? "stitched larger" : "stitched as drawn"} to make up for it.`,
                      },
                    ]
                  : []
              }
            />
          </div>
          {result.notes.map((n) => (
            <p key={n} className="cal-note">
              <TriangleAlert size={13} /> {n}
            </p>
          ))}
          {canSave && (
            <div className="cal-apply">
              <p>
                {t("filum.digitalizza.saved_for")}<b>{info.label}</b>{t("filum.digitalizza.on_this_device_new_satins")}{info.label.toLowerCase()}{t("filum.digitalizza.start_from_these_numbers_you")}
              </p>
              {affected > 0 && (
                <label className="cal-toggle">
                  <input type="checkbox" checked={applyHere} onChange={(e) => setApplyHere(e.target.checked)} />
                  {t("filum.digitalizza.also_update_the")}{affected} {affected === 1 ? t("filum.digitalizza.object") : t("filum.digitalizza.objects_3")}{t("filum.digitalizza.in_this_design_undo_with")}
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ResultCard({ icon, title, rows, empty, wasLabel }: { icon: React.ReactNode; title: string; empty: boolean; wasLabel: string; rows: { label: string; value: string; was: number; why: string }[] }) {
  return (
    <section className={`cal-card ${empty ? "empty" : ""}`}>
      <h4>
        {icon} {title}
      </h4>
      {empty ? (
        <p className="hint">{t("filum.digitalizza.not_measured_these_keep_their")}</p>
      ) : (
        <dl>
          {rows.map((r) => (
            <div key={r.label} title={r.why}>
              <dt>{r.label}</dt>
              <dd>
                <b>{r.value}</b>
                <span className="cal-was">
                  {wasLabel} {mm(r.was)}
                </span>
              </dd>
              <p className="cal-why">{r.why}</p>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** The swatch as a diagram: the stitch direction in each piece, the one being measured highlighted with its dimension. */
function SwatchDiagram({ focus, measured }: { focus: { id: PieceId; dir: Direction } | null; measured: Measurements }) {
  const S = 100;
  return (
    <div className="cal-diagram">
      <svg viewBox={`-4 -4 ${S + 8} ${S + 8}`} role="img" aria-label={t("filum.digitalizza.the_swatch_discs_a_and")}>
        <defs>
          <pattern id="cal-h" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M0 1H2" />
          </pattern>
          <pattern id="cal-v" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M1 0V2" />
          </pattern>
        </defs>
        <rect className="cal-hoop" x={0} y={0} width={S} height={S} rx={6} />
        {PIECES.map((p) => {
          const b = LAYOUT[p.id];
          const on = focus?.id === p.id;
          const done = measured[fieldKey(p.id, "along")] != null && measured[fieldKey(p.id, "across")] != null;
          const fill = `url(#cal-${p.stitches === "horizontal" ? "h" : "v"})`;
          const shape =
            p.kind === "fill" ? (
              <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} />
            ) : (
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.6} fill={fill} />
            );
          // the dimension: along = the way the stitches run
          const horizontal = (focus?.dir === "along") === (p.stitches === "horizontal");
          // vertical dimensions go on the side with room (left of the right-hand pieces)
          const left = b.x > 50;
          const dim = on
            ? horizontal
              ? { x1: b.x, y1: b.y + b.h + 4, x2: b.x + b.w, y2: b.y + b.h + 4 }
              : { x1: left ? b.x - 4 : b.x + b.w + 4, y1: b.y, x2: left ? b.x - 4 : b.x + b.w + 4, y2: b.y + b.h }
            : null;
          const tick = horizontal ? [0, -3] : [left ? 3 : -3, 0];
          return (
            <g key={p.id} className={`cal-piece ${on ? "on" : ""} ${done ? "done" : ""}`}>
              {shape}
              <text x={p.id === "c" ? b.x : p.id === "d" ? b.x - 10 : b.x - 6} y={p.id === "c" ? b.y - 6 : p.id === "d" ? b.y + 5 : b.y - 4}>
                {p.letter}
              </text>
              {dim && (
                <g className="cal-dim">
                  <line {...dim} />
                  <line x1={dim.x1} y1={dim.y1} x2={dim.x1 + tick[0]} y2={dim.y1 + tick[1]} />
                  <line x1={dim.x2} y1={dim.y2} x2={dim.x2 + tick[0]} y2={dim.y2 + tick[1]} />
                  <text
                    x={horizontal ? (dim.x1 + dim.x2) / 2 : dim.x1 + (left ? -1.5 : 1.5)}
                    y={horizontal ? dim.y1 + 5 : (dim.y1 + dim.y2) / 2 + 1.5}
                    textAnchor={horizontal ? "middle" : left ? "end" : "start"}
                  >
                    {horizontal ? b.w : b.h} mm
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <p className="cal-legend">{t("filum.digitalizza.lines_show_which_way_the")}</p>
    </div>
  );
}
