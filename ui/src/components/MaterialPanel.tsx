// Fabric and thread of the design: the fabric preset with what its makers
// recommend underneath and on top, the thread weight, and the hoop's shape.

import { t } from "../nova/i18n/filum";
import { Circle, Ruler, Square, TriangleAlert } from "lucide-react";
import { calibrationFor } from "../lib/calibration";
import { Fabric, Knockdown } from "../icons/stitch";
import { defaultDesignOptions } from "../lib/geometry";
import { FABRICS, fabricInfo, THREAD_WEIGHTS, threadWeightInfo } from "../lib/materials";
import { PILE } from "../lib/underlay";
import { useStore } from "../store";
import { chooseHoop } from "../nova/core/hoopChoice";
import { NovaSlot } from "../nova/core/Slot";
import type { HoopShape, ThreadWeight } from "../types";
import { Row } from "./ui";

/** Rectangle / oval switch for the design hoop. */
export function HoopShapeRow() {
  const hoop = useStore((s) => s.doc.hoop);
  const commit = useStore((s) => s.commit);
  const shape = hoop.shape ?? "rect";
  // NOVAstitch: through chooseHoop (module a: a.hoop.custom)
  const set = (v: HoopShape) => chooseHoop({ source: "custom", hoop: { ...hoop, shape: v === "rect" ? undefined : v, name: t("filum.pannelli.custom") } }, () => commit((d) => ({ ...d, hoop: { ...d.hoop, shape: v === "rect" ? undefined : v, name: t("filum.pannelli.custom") } })));
  return (
    <Row label={t("filum.pannelli.shape")} title={t("filum.pannelli.oval_and_round_hoops_the")}>
      <div className="seg mt-shape">
        <button className={shape === "rect" ? "on" : ""} onClick={() => set("rect")} title={t("filum.pannelli.rectangle")}>
          <Square size={12} />{t("filum.pannelli.rectangle_2")}
        </button>
        <button className={shape === "oval" ? "on" : ""} onClick={() => set("oval")} title={t("filum.pannelli.oval_round_when_width_height")}>
          <Circle size={12} /> {Math.abs(hoop.width - hoop.height) < 0.01 ? t("filum.pannelli.round") : t("filum.pannelli.oval")}
        </button>
      </div>
    </Row>
  );
}

/** Fabric preset, thread weight and the stabiliser / needle advice for both. */
export function MaterialSection() {
  const doc = useStore((s) => s.doc);
  const commit = useStore((s) => s.commit);
  const fabric = fabricInfo(doc.fabric);
  // re-read when the dialog closes (the calibration lives on the device, not in the design)
  useStore((s) => s.dialog);
  const calibrated = calibrationFor(doc.fabric);
  const weight = threadWeightInfo(doc.options?.threadWeight);
  const setWeight = (w: ThreadWeight) => commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), threadWeight: w } }));
  return (
    <>
      <Row label={t("filum.pannelli.fabric")} title={t("filum.pannelli.adjusts_density_and_underlay_for")}>
        <div className="mt-fabric">
          <select className="select" value={doc.fabric} onChange={(e) => useStore.getState().setFabric(e.target.value as never)}>
            {FABRICS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            className={`icon-btn ${calibrated ? "on" : ""}`}
            title={calibrated ? t("filum.pannelli.calibrated_on_this_device_date", { date: calibrated.date }) : t("filum.pannelli.calibrate_this_fabric_sew_a")}
            onClick={() => useStore.getState().setDialog("calibrate")}
          >
            <Ruler size={13} />
          </button>
        </div>
      </Row>
      {/* NOVAstitch: the modules' space under the fabric picker (nova/core/slots.ts) */}
      <NovaSlot name="material" props={{}} />
      <Row label={t("filum.pannelli.thread_2")} title={t("filum.pannelli.top_thread_weight_finer_thread")}>
        <div className="seg mt-weights">
          {THREAD_WEIGHTS.map((th) => (
            <button key={th.weight} className={weight.weight === th.weight ? "on" : ""} title={t("filum.pannelli.label_v2_mm_satin_spacing", { label: th.label, v2: th.spacing.toFixed(2), needle: th.needle })} onClick={() => setWeight(th.weight)}>
              {th.weight}
            </button>
          ))}
        </div>
      </Row>
      <div className="mt-card">
        <p className="mt-effect">
          <Fabric size={12} /> {fabric.effect}
          {calibrated && t("filum.pannelli.calibrated_pull_compensation_for_new")}
          {weight.weight !== 40 && t("filum.pannelli.spacing_v1_for_no_weight", { v1: (weight.spacing / 0.4).toFixed(2), weight: weight.weight })}
        </p>
        <dl className="mt-advice">
          <dt>{t("filum.pannelli.backing")}</dt>
          <dd>{fabric.backing}</dd>
          <dt>Topping</dt>
          <dd>{fabric.topping}</dd>
          <dt>{t("filum.pannelli.needle")}</dt>
          <dd>
            {fabric.needle}
            {weight.weight !== 40 && <span className="mt-sub"> {t("filum.pannelli.no_weight_thread_needle", { weight: weight.weight, needle: weight.needle })}</span>}
          </dd>
          <dt>{t("filum.pannelli.smallest_text")}</dt>
          <dd title={weight.minTextSource}>
            {weight.minText}{t("filum.pannelli.mm_cap_height")}
            {doc.fabric === "cap" && weight.weight === 40 && <span className="mt-sub">{t("filum.pannelli.n6_4_mm_on_caps")}</span>}
          </dd>
        </dl>
        {fabric.confidence !== "agreed" && (
          <p className={`mt-note ${fabric.confidence}`}>
            <TriangleAlert size={12} /> {fabric.note}
          </p>
        )}
      </div>
      {PILE.includes(doc.fabric) && <KnockdownSuggestion />}
    </>
  );
}

/** Pile fabrics: offer the knockdown that keeps the embroidery on top of the loops. */
function KnockdownSuggestion() {
  const on = useStore((s) => !!s.doc.options?.knockdown);
  const fabricColor = useStore((s) => s.fabricColor);
  const commit = useStore((s) => s.commit);
  const turnOn = () =>
    commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), knockdown: true, knockdownColor: d.options?.knockdownColor || fabricColor } }));
  return (
    <div className={`mt-suggest ${on ? "done" : ""}`}>
      <Knockdown size={12} />
      {on ? (
        <span>{t("filum.pannelli.knockdown_is_on_the_net")}</span>
      ) : (
        <>
          <span>{t("filum.pannelli.pile_fabric_a_knockdown_net")}</span>
          <button className="btn sm primary" onClick={turnOn}>
            {t("filum.pannelli.add_knockdown")}
          </button>
        </>
      )}
    </div>
  );
}
