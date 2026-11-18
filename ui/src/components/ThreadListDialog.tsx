// Apply a thread list (Ink/Stitch "Apply thread list"): the colour blocks of
// the design next to the threads of a TXT / COL / EDR / INF file, block by
// block — e.g. to bring back the colours of a DST, which stores none.

import { ArrowRight, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { engine } from "../engine/client";
import { openFile } from "../lib/platform";
import { chartLabel, loadChart, useCharts } from "../lib/threads";
import { matchCatalog, needsChart, pendingThreadList, THREAD_LIST_EXT } from "../lib/threadList";
import { syncTextThreads } from "../lib/textSettle";
import { useStore } from "../store";
import type { ThreadListEntry } from "../types";
import { lastChart } from "./ThreadPicker";
import { Dialog } from "./ui";
import "../output.css";
import { t, tn } from "../nova/i18n/filum";

/** Pick a thread list file and open the dialog with it. */
export async function chooseThreadList() {
  const f = await openFile([{ name: t("filum.finestre.thread_lists_txt_col_edr"), extensions: THREAD_LIST_EXT }]);
  if (!f) return;
  pendingThreadList.name = f.name;
  pendingThreadList.bytes = f.bytes;
  useStore.getState().setDialog("threadlist");
}

const KIND: Record<string, string> = {
  txt: "Text thread list",
  col: "COL thread colours",
  edr: "EDR thread colours (Embird)",
  inf: "INF threads (Viking, Pfaff)",
};

export function ThreadListDialog({ onClose }: { onClose: () => void }) {
  const plan = useStore((s) => s.plan);
  const [file, setFile] = useState(() => ({ ...pendingThreadList }));
  const [list, setList] = useState<{ kind: string; entries: ThreadListEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const charts = useCharts();
  const [chart, setChart] = useState(lastChart);
  const [matched, setMatched] = useState<ThreadListEntry[] | null>(null);

  useEffect(() => {
    if (!file.bytes.length) return;
    setError(null);
    setList(null);
    engine
      .readThreadList(file.bytes, file.name)
      .then(setList)
      .catch((e) => setError((e as Error).message));
  }, [file]);
  // Ink/Stitch method 2: lines without colours, matched by catalogue number
  const chartNeeded = !!list && needsChart(list.entries);
  useEffect(() => {
    if (!list) return setMatched(null);
    if (!chartNeeded) return setMatched(list.entries);
    let live = true;
    loadChart(chart)
      .then((c) => live && setMatched(matchCatalog(list.entries, c)))
      .catch(() => live && setMatched(list.entries));
    return () => {
      live = false;
    };
  }, [list, chart, chartNeeded]);

  const blocks = plan?.threads ?? [];
  const entries = matched ?? [];
  const rows = Math.max(blocks.length, entries.length);
  const applied = useMemo(() => blocks.filter((_, i) => entries[i]?.color).length, [blocks, entries]);
  const unchanged = blocks.filter((b, i) => entries[i]?.color && entries[i].color!.toLowerCase() === b.color.toLowerCase()).length;

  const apply = async () => {
    const s = useStore.getState();
    try {
      const r = await engine.applyThreadList(s.doc, entries);
      let shapes = 0;
      s.commit((d) => {
        const touched = new Set<string>();
        const objects = d.objects.map((o, i) => {
          const thread = r.document.objects[i]?.thread ?? o.thread;
          if (thread === o.thread) return o;
          if (o.text) touched.add(o.text.group);
          return { ...o, thread };
        });
        // letterings keep their new colours when laid out again (a thread the
        // engine split into two can't be one lettering colour: those become shapes)
        const synced = syncTextThreads(objects, touched);
        shapes = synced.shapes;
        return { ...d, threads: r.document.threads, objects: synced.objects, threadSources: r.document.threadSources };
      });
      s.toast(
        tn("filum.finestre.applied_blocks", r.report.blocks, { applied: r.report.applied, file: file.name }) +
          (shapes ? tn("filum.finestre.letterings_became_shapes", shapes) : ""),
        "success",
      );
      onClose();
    } catch (e) {
      s.toast(t("filum.finestre.could_not_apply_the_thread", { message: (e as Error).message }), "error");
    }
  };
  const pick = async () => {
    const f = await openFile([{ name: t("filum.finestre.thread_lists_txt_col_edr"), extensions: THREAD_LIST_EXT }]);
    if (f) setFile({ name: f.name, bytes: f.bytes });
  };
  const sw = (c: string | null | undefined) => <i className={c ? "" : "none"} style={c ? { background: c } : undefined} />;
  const label = (e: { name: string; code: string; brand: string }) => [e.brand, e.code].filter(Boolean).join(" ") + (e.name ? ` ${e.name}` : "");

  return (
    <Dialog
      live
      wide
      title={t("filum.finestre.apply_thread_list")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={pick}>
            <FileText size={14} /> {file.bytes.length ? t("filum.finestre.other_file") : t("filum.finestre.choose_file")}
          </button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.finestre.cancel")}
          </button>
          <button className="btn primary" disabled={!applied || !blocks.length} onClick={apply}>
            {t("filum.finestre.apply_2")}{applied ? tn("filum.finestre.n_colours", applied) : ""}
          </button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        {t("filum.finestre.colour_block_1_gets_the")}
      </p>
      {!file.bytes.length && <p className="hint">{t("filum.finestre.choose_a_thread_list_ink")}</p>}
      {error && <p className="hint" style={{ color: "var(--danger-text)" }}>{file.name}: {error}</p>}
      {list && (
        <>
          <div className="tl-summary">
            <b>{file.name}</b>
            <span className="badge">{KIND[list.kind] ?? list.kind.toUpperCase()}</span>
            <span className="stat">
              {tn("filum.finestre.n_threads", list.entries.length)}{t("filum.finestre.the_design_has")}{tn("filum.finestre.n_colour_blocks", blocks.length)}
              {unchanged ? t("filum.finestre.unchanged_already_match", { unchanged }) : ""}
            </span>
          </div>
          {list.entries.length !== blocks.length && blocks.length > 0 && (
            <p className="hint">
              {list.entries.length < blocks.length
                ? tn("filum.finestre.list_shorter", blocks.length - list.entries.length)
                : tn("filum.finestre.list_longer", list.entries.length - blocks.length)}
            </p>
          )}
          {chartNeeded && (
            <label className="row" title={t("filum.finestre.the_list_names_catalogue_numbers")}>
              <span>{t("filum.finestre.match_numbers_in")}</span>
              <select className="select" value={chart} onChange={(e) => setChart(e.target.value)}>
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {!charts.some((c) => c.id === chart) && <option value={chart}>{chartLabel(chart)}</option>}
              </select>
            </label>
          )}
          <div className="tl-list">
            {Array.from({ length: rows }, (_, i) => {
              const b = blocks[i];
              const e = entries[i];
              const same = !!b && !!e?.color && e.color.toLowerCase() === b.color.toLowerCase();
              return (
                <div key={i} className={`tl-row ${same ? "same" : ""}`}>
                  <span className="stat">{i + 1}</span>
                  {sw(b?.color)}
                  <span className="nm" title={b ? label(b) : undefined}>
                    {b ? label(b) || b.color : <span className="stat">{t("filum.finestre.no_block")}</span>}
                  </span>
                  <ArrowRight size={12} className="stat" />
                  {sw(e?.color)}
                  <span className="nm" title={e ? label(e) : undefined}>
                    {!e ? <span className="stat">{t("filum.finestre.keeps_its_colour")}</span> : e.color ? label(e) || e.color : <span className="stat">{t("filum.finestre.no_colour")}{e.tokens?.length ? t("filum.finestre.v1_not_in_the_chart", { v1: e.tokens.join(" ") }) : ""}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Dialog>
  );
}
