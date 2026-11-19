// Element info (Ink/Stitch "Element info"): for the selected objects their
// type, method, size, stitches, small stitches left out, jumps and the
// longest / shortest stitch — and the totals of the selection (or the whole
// design): colours, colour changes, jumps, trims, stops. Copy as a table.

import { t, tn } from "../nova/i18n/filum";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { engine } from "../engine/client";
import { useStore } from "../store";
import type { ElementInfo, ObjectInfo } from "../types";
import { Section } from "./ui";
import "../output.css";

const KIND: Record<string, string> = {
  fill: "Fill",
  satin: "Satin column",
  running: "Stroke",
  applique: "Appliqué",
  manual: "Manual stitch",
  none: "Not stitched",
};
const METHOD: Record<string, string> = {
  tatami: "Auto fill (tatami)",
  contour: "Contour fill",
  guided: "Guided fill",
  meander: "Meander fill",
  circular: "Circular fill",
  cross: "Cross stitch",
  flow: "Flow fill",
  curved: "Curved fill",
  satin: "Satin column",
  eStitch: "E-stitch",
  sStitch: "S-stitch",
  zigzag: "Zig-zag",
  running: "Running stitch",
  bean: "Bean stitch",
  ripple: "Ripple stitch",
  stem: "Stem stitch",
  motif: "Motif stitch",
};
/** "streamline" → "Streamline", "linearGradient" → "Linear gradient". */
const words = (id: string) => (id ? (id[0].toUpperCase() + id.slice(1)).replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`) : "");
export const methodLabel = (o: Pick<ObjectInfo, "kind" | "method">) => (o.method ? (METHOD[o.method] ?? `${words(o.method)}${o.kind === "fill" ? " fill" : ""}`) : (KIND[o.kind] ?? words(o.kind)));
const mm = (v: number) => v.toFixed(2);

/** Ink/Stitch's export text: one tab-separated line per object. */
export function infoTable(info: ElementInfo): string {
  let s = "element_id\ttype\tmethod\tdimensions\tstitches\tjumps\tmax_stitch_length\tmin_stitch_length\n";
  for (const o of info.objects) s += `${o.id}\t${KIND[o.kind] ?? o.kind}\t${methodLabel(o)}\t${mm(o.width)} x ${mm(o.height)}\t${o.stitches}\t${o.jumps}\t${mm(o.maxStitch)}\t${mm(o.minStitch)}\n`;
  return s;
}

function useElementInfo(ids: string[]): ElementInfo | null {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const [info, setInfo] = useState<ElementInfo | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      engine
        .elementInfo(doc, ids)
        .then((i) => live && setInfo(i))
        .catch(() => live && setInfo(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // the plan changes with everything that changes stitches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, key]);
  return info;
}

function ObjectRows({ o }: { o: ObjectInfo }) {
  return (
    <dl className="ei-grid">
      <dt>{t("filum.pannelli.type")}</dt>
      <dd>{KIND[o.kind] ?? words(o.kind)}</dd>
      {o.method && (
        <>
          <dt>{t("filum.pannelli.method")}</dt>
          <dd>{methodLabel(o)}</dd>
        </>
      )}
      <dt>{t("filum.pannelli.dimensions")}</dt>
      <dd>
        {t("filum.pannelli.n_n2_mm", { n: mm(o.width), n2: mm(o.height) })}</dd>
      <dt>{t("filum.pannelli.stitches")}</dt>
      <dd className={o.stitches ? "" : "warn"} title={o.hidden ? t("filum.pannelli.not_stitched_hidden_or_covered") : undefined}>
        {o.stitches.toLocaleString()}
      </dd>
      <dt title={t("filum.pannelli.stitches_shorter_than_the_minimum")}>{t("filum.pannelli.small_stitches_removed")}</dt>
      <dd>{o.smallRemoved.toLocaleString()}</dd>
      <dt title={t("filum.pannelli.jumps_inside_the_object_not")}>{t("filum.pannelli.jumps")}</dt>
      <dd>{o.jumps}</dd>
      <dt>{t("filum.pannelli.max_stitch_length")}</dt>
      <dd>{t("filum.pannelli.n_mm", { n: mm(o.maxStitch) })}</dd>
      <dt>{t("filum.pannelli.min_stitch_length")}</dt>
      <dd>{t("filum.pannelli.n_mm", { n: mm(o.minStitch) })}</dd>
    </dl>
  );
}

function Panel({ ids }: { ids: string[] }) {
  const info = useElementInfo(ids);
  const toast = useStore((s) => s.toast);
  if (!info) return <p className="hint">{t("filum.pannelli.counting")}</p>;
  const th = info.total;
  const single = ids.length === 1 && info.objects.length === 1;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(infoTable(info));
      toast(tn("filum.pannelli.copied_info_n_objects", info.objects.length), "success");
    } catch {
      toast(t("filum.pannelli.could_not_copy_to_the"), "error");
    }
  };
  return (
    <div className="ei">
      {single ? (
        <ObjectRows o={info.objects[0]} />
      ) : (
        <>
          <dl className="ei-grid">
            <dt>{ids.length ? t("filum.pannelli.selected_objects") : t("filum.pannelli.objects_2")}</dt>
            <dd>{th.objects}</dd>
            <dt>{t("filum.pannelli.dimensions")}</dt>
            <dd>
              {t("filum.pannelli.n_n2_mm", { n: mm(th.width), n2: mm(th.height) })}</dd>
            <dt>{t("filum.pannelli.colours")}</dt>
            <dd>{th.colors}</dd>
            <dt>{t("filum.pannelli.colour_changes")}</dt>
            <dd>{th.colorChanges}</dd>
            <dt>{t("filum.pannelli.jumps")}</dt>
            <dd>{th.jumps}</dd>
            <dt>{t("filum.pannelli.trims")}</dt>
            <dd>{th.trims}</dd>
            <dt>{t("filum.pannelli.stops")}</dt>
            <dd>{th.stops}</dd>
            <dt>{t("filum.pannelli.stitches")}</dt>
            <dd>{th.stitches.toLocaleString()}</dd>
            <dt>{t("filum.pannelli.small_stitches_removed")}</dt>
            <dd>{th.smallRemoved.toLocaleString()}</dd>
            <dt>{t("filum.pannelli.min_stitch_length")}</dt>
            <dd>{t("filum.pannelli.n_mm", { n: mm(th.minStitch) })}</dd>
            <dt>{t("filum.pannelli.max_stitch_length")}</dt>
            <dd>{t("filum.pannelli.n_mm", { n: mm(th.maxStitch) })}</dd>
            <dt title={t("filum.pannelli.design_stitch_out_min_stitch")}>{t("filum.pannelli.filter_stitches_smaller_than")}</dt>
            <dd>{t("filum.pannelli.n_mm", { n: mm(th.minStitchFilter) })}</dd>
          </dl>
          {info.objects.length > 1 && info.objects.length <= 40 && (
            <Section title={t("filum.pannelli.each_object_length", { length: info.objects.length })} defaultOpen={false}>
              {info.objects.map((o) => (
                <div key={o.id} className="ei-obj">
                  <div className="ei-obj-head">
                    <i style={{ background: o.color }} />
                    <span>{o.name || o.id}</span>
                  </div>
                  <ObjectRows o={o} />
                </div>
              ))}
            </Section>
          )}
        </>
      )}
      <div className="ei-actions">
        <button className="btn sm ghost" onClick={copy} title={t("filum.pannelli.copy_every_object_s_info")}>
          <Copy size={12} />{t("filum.pannelli.copy_table")}
        </button>
      </div>
    </div>
  );
}

/** "Info" section of the Properties panel: the selection, or the whole design when `ids` is empty. */
export function ElementInfoSection({ ids, defaultOpen = false, title }: { ids: string[]; defaultOpen?: boolean; title?: string }) {
  return (
    <Section title={title ?? t("filum.pannelli.element_info")} defaultOpen={defaultOpen}>
      <Panel ids={ids} />
    </Section>
  );
}
