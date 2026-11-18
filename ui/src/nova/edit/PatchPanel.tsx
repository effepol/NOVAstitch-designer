// Module f: the Patch panel (a tab of the layers panel, from module 0's registry).
// Prepare a grid from the selection (f.patch.create), and for every patch in the
// design: order of the pieces, colour grouping with both colour-change counts and
// times, and «Centre in the hoop» (also offered when a patch goes beyond it).

import { useEffect, useState, useSyncExternalStore } from "react";
import { runCommand } from "../core/commands";
import { on } from "../core/events";
import { t, useLanguage } from "../core/i18n";
import { Num, Row } from "../../components/ui";
import { useStore } from "../../store";
import type { PatchGroup, StitchDocument, Vec2 } from "../../types";
import { colorChanges, GROUPINGS, ORDERS, type ColorGrouping } from "./patch";
import { getDraft, onDraft, setDraft } from "./draft";
import { LibraryPanel } from "./LibraryPanel";
import "./texts";

/** Create a patch from the selection with the prepared settings; a toast says why when it cannot. */
export function createFromSelection(): void {
  const s = useStore.getState();
  if (!s.selection.length) return s.toast(t("f.patch.noSelection"), "error");
  const before = s.doc;
  runCommand("f.patch.create", { ...getDraft(), sourceIds: s.selection });
  if (useStore.getState().doc === before) s.toast(t("f.patch.refused"), "error");
}

/** Estimated sewing time with the group sewn in `mode`: the plan's time, corrected for the colour changes. */
function minutes(doc: StitchDocument, seconds: number | undefined, g: PatchGroup, mode: ColorGrouping): number | null {
  if (seconds === undefined) return null;
  const delta = colorChanges(doc, g.id, mode) - colorChanges(doc, g.id);
  return Math.max(0, Math.round((seconds + delta * (doc.machine.colorChangeSeconds ?? 0)) / 6) / 10);
}

function GroupRow({ g }: { g: PatchGroup }) {
  const doc = useStore((s) => s.doc);
  const seconds = useStore((s) => s.plan?.stats.seconds);
  return (
    <div className="props">
      <p className="hint">{t("f.patch.group", { rows: g.rows, cols: g.cols })}</p>
      <Row label={t("f.patch.order")}>
        <select
          className="select"
          data-nova-anchor="f.patch.order"
          value={g.order}
          onChange={(e) => runCommand("f.patch.setOrder", { groupId: g.id, order: e.target.value })}
        >
          {ORDERS.map((o) => (
            <option key={o} value={o}>
              {t(`f.patch.order.${o}`)}
            </option>
          ))}
        </select>
      </Row>
      <div data-nova-anchor="f.patch.grouping">
      {GROUPINGS.map((mode) => {
        const min = minutes(doc, seconds, g, mode);
        return (
          <label key={mode} className="row">
            <input
              type="radio"
              checked={g.colorGrouping === mode}
              onChange={() => runCommand("f.patch.setColorGrouping", { groupId: g.id, mode })}
            />
            <span>
              {t(`f.patch.grouping.${mode}`)} · {t("f.patch.changes", { n: colorChanges(doc, g.id, mode) })}
              {min !== null ? ` · ${t("f.patch.time", { min })}` : ""}
            </span>
          </label>
        );
      })}
      </div>
      <button className="btn ghost" data-nova-anchor="f.patch.center" onClick={() => runCommand("f.patch.center", { groupId: g.id })}>
        {t("f.patch.center")}
      </button>
    </div>
  );
}

const NONE: PatchGroup[] = [];

export function PatchPanel() {
  useLanguage();
  const draft = useSyncExternalStore(onDraft, getDraft);
  // the stored array itself (a new [] at every read would render again forever)
  const groups = useStore((s) => s.doc.nova?.patchGroups) ?? NONE;
  const hasSelection = useStore((s) => s.selection.length > 0);
  const [outside, setOutside] = useState<{ groupId: string; overflow: Vec2 } | null>(null);
  useEffect(() => on("patch.outsideHoop", (p) => setOutside(p)), []);
  const gap = (i: 0 | 1, v: number) => setDraft({ gap: (i ? [draft.gap[0], v] : [v, draft.gap[1]]) as Vec2 });

  return (
    <div className="props" data-nova-anchor="f.patch.panel">
      {outside && groups.some((g) => g.id === outside.groupId) && (
        <div className="props">
          <p className="hint">{t("f.patch.outside", { x: outside.overflow[0], y: outside.overflow[1] })}</p>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="btn primary"
              onClick={() => {
                runCommand("f.patch.center", { groupId: outside.groupId });
                setOutside(null);
              }}
            >
              {t("f.patch.center")}
            </button>
            <button className="btn ghost" onClick={() => setOutside(null)}>
              {t("f.patch.dismiss")}
            </button>
          </div>
        </div>
      )}
      <p className="hint">
        <b>{t("f.library.title")}</b>
      </p>
      <LibraryPanel />
      <p className="hint">
        <b>{t("f.patch.gridTitle")}</b>
      </p>
      <p className="hint">{t("f.patch.hint")}</p>
      <Row label={t("f.patch.rows")}>
        <span data-nova-anchor="f.patch.rows">
          <Num value={draft.rows} step={1} min={1} max={20} digits={0} onChange={(v) => setDraft({ rows: Math.max(1, Math.round(v)) })} />
        </span>
      </Row>
      <Row label={t("f.patch.cols")}>
        <span data-nova-anchor="f.patch.cols">
          <Num value={draft.cols} step={1} min={1} max={20} digits={0} onChange={(v) => setDraft({ cols: Math.max(1, Math.round(v)) })} />
        </span>
      </Row>
      <p className="hint">{t("f.patch.pieces", { n: draft.rows * draft.cols })}</p>
      <Row label={t("f.patch.gapX")}>
        <span data-nova-anchor="f.patch.gap">
          <Num value={draft.gap[0]} unit="mm" step={0.5} onChange={(v) => gap(0, v)} />
        </span>
      </Row>
      <Row label={t("f.patch.gapY")}>
        <Num value={draft.gap[1]} unit="mm" step={0.5} onChange={(v) => gap(1, v)} />
      </Row>
      <Row label={t("f.patch.order")}>
        <select className="select" value={draft.order} onChange={(e) => setDraft({ order: e.target.value as typeof draft.order })}>
          {ORDERS.map((o) => (
            <option key={o} value={o}>
              {t(`f.patch.order.${o}`)}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("f.patch.grouping")}>
        <select className="select" value={draft.colorGrouping} onChange={(e) => setDraft({ colorGrouping: e.target.value as ColorGrouping })}>
          {GROUPINGS.map((m) => (
            <option key={m} value={m}>
              {t(`f.patch.grouping.${m}`)}
            </option>
          ))}
        </select>
      </Row>
      <button className="btn primary" data-nova-anchor="f.patch.create" disabled={!hasSelection || draft.rows * draft.cols < 2} onClick={createFromSelection}>
        {t("f.patch.create")}
      </button>
      {groups.length > 0 && <p className="hint">{t("f.patch.groups")}</p>}
      {groups.map((g) => (
        <GroupRow key={g.id} g={g} />
      ))}
    </div>
  );
}
