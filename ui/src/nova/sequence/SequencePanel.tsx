// Module b: the «Sequence» panel, a tab registered beside Filum's Layers and Issues.
// One row per object in sewing order (a lettering is one row); per row the
// lock stitches at the start and end, trim after, stop after and the stitch
// count from the plan. Every change goes through a command (one undo step);
// dragging a row reorders on the drop, with b.reorder.

import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { GripVertical, MapPin, MapPinOff, Type } from "lucide-react";
import { LockStitch, MachineStop, Trim } from "../../icons/stitch";
import { planOf, useStore } from "../../store";
import type { StitchDocument } from "../../types";
import { runCommand } from "../core/commands";
import { currentMode } from "../core/mode";
import { t, useLanguage } from "../core/i18n";
import { withTie, tiesOf } from "./commands";
import { focusRow } from "./events";
import { dropTarget, rowStitches, sequenceRows, stitchesPerObject, type SequenceRow } from "./rows";
import "./texts";

const COLUMNS: CSSProperties = { gridTemplateColumns: "12px 18px 10px minmax(0, 1fr) auto auto 18px 18px 18px 18px" };
const on: CSSProperties = { color: "var(--accent)" };

type Drop = { key: string; over: string | null; at: "above" | "below" };

export function SequencePanel() {
  useLanguage();
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  useStore((s) => s.plan);
  // the plan of this very document, else the last counts known (by object id) while it is planned
  const last = useRef<Map<string, number> | null>(null);
  const plan = planOf.get(doc);
  const counts = useMemo(() => (plan ? (last.current = stitchesPerObject(doc, plan)) : last.current), [doc, plan]);
  return <SequenceView doc={doc} selection={selection} counts={counts} assisted={currentMode() === "assisted"} />;
}

/** The list itself, from what it shows (no store hooks: the tests draw it in Node). */
export function SequenceView({ doc, selection, counts, assisted }: { doc: StitchDocument; selection: string[]; counts: Map<string, number> | null; assisted: boolean }) {
  const rows = useMemo(() => sequenceRows(doc), [doc]);
  const [drag, setDrag] = useState<Drop | null>(null);
  const colors = new Map(doc.threads.map((th) => [th.id, th.color]));
  const selected = new Set(selection);

  if (!rows.length)
    return (
      <div className="hint" style={{ padding: 14 }} data-nova-anchor="b.panel">
        {t("b.empty")}
      </div>
    );

  const handlers = {
    start: (key: string) => setDrag({ key, over: null, at: "above" }),
    over: (key: string, e: DragEvent) => {
      if (!drag) return;
      e.preventDefault();
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const at = e.clientY < box.top + box.height / 2 ? "above" : "below";
      const over = key === drag.key ? null : key;
      if (drag.over !== over || drag.at !== at) setDrag({ ...drag, over, at });
    },
    drop: (key: string, e: DragEvent) => {
      e.preventDefault();
      const d = drag;
      setDrag(null);
      const target = d && dropTarget(rows, d.key, key, d.at);
      if (target) runCommand("b.reorder", target);
    },
    end: () => setDrag(null),
  };

  return (
    <div role="list" aria-label={t("b.list")} data-nova-anchor="b.panel">
      {rows.map((r, i) => (
        <Row
          key={r.key}
          r={r}
          i={i}
          color={colors.get(r.first.thread) ?? "transparent"}
          sel={r.ids.every((id) => selected.has(id))}
          stitches={rowStitches(r, counts)}
          assisted={assisted}
          drop={drag?.over === r.key ? drag.at : null}
          dragging={drag?.key === r.key}
          h={handlers}
        />
      ))}
    </div>
  );
}

interface Handlers {
  start: (key: string) => void;
  over: (key: string, e: DragEvent) => void;
  drop: (key: string, e: DragEvent) => void;
  end: () => void;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function Row({
  r,
  i,
  color,
  sel,
  stitches,
  assisted,
  drop,
  dragging,
  h,
}: {
  r: SequenceRow;
  i: number;
  color: string;
  sel: boolean;
  stitches: number | undefined;
  assisted: boolean;
  drop: "above" | "below" | null;
  dragging: boolean;
  h: Handlers;
}) {
  const name = r.text ? (r.first.text?.content?.split("\n")[0] ?? r.first.name) : r.first.name;
  const focus = () => {
    useStore.getState().select(r.ids);
    focusRow(r.key);
  };
  const tie = (end: "start" | "end") => {
    const o = end === "start" ? r.first : r.last;
    const now = end === "start" ? r.startTie : r.endTie;
    runCommand("b.setTies", { id: o.id, ties: withTie(tiesOf(o), end, !now) });
  };
  const tieTitle = (end: "start" | "end", lit: boolean) => (assisted ? t("b.tie.assisted") : t(`b.tie${end === "start" ? "Start" : "End"}.${lit ? "on" : "off"}`));
  return (
    <div
      role="listitem"
      className={`layer ${sel ? "sel" : ""} ${drop ? `drop-${drop}` : ""}`}
      style={dragging ? { ...COLUMNS, opacity: 0.5 } : COLUMNS}
      tabIndex={0}
      data-nova-anchor="b.row"
      onClick={focus}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        focus();
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        h.start(r.key);
      }}
      onDragOver={(e) => h.over(r.key, e)}
      onDrop={(e) => h.drop(r.key, e)}
      onDragEnd={h.end}
    >
      <span title={t("b.drag")} data-nova-anchor="b.grip">
        <GripVertical size={12} className="grip" />
      </span>
      <span className="idx">{i + 1}</span>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: "0 0 0 1px var(--border)" }} />
      <span className="lname" title={name}>
        {r.text && <Type size={11} style={{ verticalAlign: -1, marginRight: 4, opacity: 0.7 }} aria-label={t("b.lettering")} />}
        {name}
      </span>
      <span className="idx" data-nova-anchor="b.stitches" title={stitches === undefined ? t("b.stitchesUnknown") : t("b.stitches", { n: stitches })}>
        {stitches ?? "…"}
      </span>
      <span style={{ display: "flex" }}>
        {r.start && (
          <button className="mini" data-nova-anchor="b.startAuto" title={t("b.start.auto")} aria-label={t("b.start.auto")} onClick={(e) => (stop(e), runCommand("b.setStart", { id: r.first.id, point: null }))}>
            <MapPin size={13} />
          </button>
        )}
        {r.end && (
          <button className="mini" data-nova-anchor="b.endAuto" title={t("b.end.auto")} aria-label={t("b.end.auto")} onClick={(e) => (stop(e), runCommand("b.setEnd", { id: r.last.id, point: null }))}>
            <MapPinOff size={13} />
          </button>
        )}
      </span>
      <button
        className={`mini ${r.startTie ? "" : "mixed"}`}
        style={r.startTie ? on : undefined}
        data-nova-anchor="b.tieStart"
        aria-pressed={r.startTie}
        disabled={assisted}
        title={tieTitle("start", r.startTie)}
        aria-label={tieTitle("start", r.startTie)}
        onClick={(e) => (stop(e), tie("start"))}
      >
        <LockStitch size={14} />
      </button>
      <button
        className={`mini ${r.endTie ? "" : "mixed"}`}
        style={r.endTie ? { ...on, transform: "scaleX(-1)" } : { transform: "scaleX(-1)" }}
        data-nova-anchor="b.tieEnd"
        aria-pressed={r.endTie}
        disabled={assisted}
        title={tieTitle("end", r.endTie)}
        aria-label={tieTitle("end", r.endTie)}
        onClick={(e) => (stop(e), tie("end"))}
      >
        <LockStitch size={14} />
      </button>
      <button
        className={`mini ${r.trimAfter ? "" : "mixed"}`}
        style={r.trimAfter ? on : undefined}
        data-nova-anchor="b.trim"
        aria-pressed={r.trimAfter}
        title={t(r.trimAfter ? "b.trim.on" : "b.trim.off")}
        aria-label={t(r.trimAfter ? "b.trim.on" : "b.trim.off")}
        onClick={(e) => (stop(e), runCommand("b.setTrimAfter", { id: r.last.id, value: !r.trimAfter }))}
      >
        <Trim size={14} />
      </button>
      <button
        className={`mini ${r.stopAfter ? "" : "mixed"}`}
        style={r.stopAfter ? on : undefined}
        data-nova-anchor="b.stop"
        aria-pressed={r.stopAfter}
        title={t(r.stopAfter ? "b.stop.on" : "b.stop.off")}
        aria-label={t(r.stopAfter ? "b.stop.on" : "b.stop.off")}
        onClick={(e) => (stop(e), runCommand("b.setStopAfter", { id: r.last.id, value: !r.stopAfter }))}
      >
        <MachineStop size={14} />
      </button>
    </div>
  );
}
