// Module a: the panel of the user's own hoops (a tab of the layers panel).
// Use one (a.hoop.select), add, change or delete one (a.userHoops.*; deleting
// asks first). Changing or deleting never touches a design.

import { useState, useSyncExternalStore } from "react";
import { runCommand } from "../core/commands";
import { on } from "../core/events";
import { t, useLanguage } from "../core/i18n";
import { Num, Row } from "../../components/ui";
import { useStore } from "../../store";
import type { UserHoop, UserHoops } from "./userHoops";
import "./texts";

type Draft = Omit<UserHoop, "id"> & { id?: string };
const empty = (): Draft => ({
  name: "",
  width: 150,
  height: 150,
  shape: "rect",
  kind: "flat",
});

let version = 0;
on("userHoops.changed", () => version++);

/** The list, rendered again at every userHoops.changed. */
function useList(hoops: UserHoops): UserHoop[] {
  useSyncExternalStore(
    (fn) => on("userHoops.changed", fn),
    () => version,
  );
  return hoops.list();
}

export function HoopsPanel({ hoops }: { hoops: UserHoops }) {
  useLanguage();
  const list = useList(hoops);
  const current = useStore((s) => s.doc.nova?.hoopRef?.id);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState<Draft>(empty);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const fail = (e: unknown) =>
    toast(
      t("a.hoops.error", { message: (e as Error)?.message ?? String(e) }),
      "error",
    );

  const save = async () => {
    try {
      if (draft.id) await hoops.update(draft as UserHoop);
      else await hoops.add(draft);
      setDraft(empty());
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (h: UserHoop) => {
    try {
      await hoops.remove(h.id, () =>
        confirm(t("a.hoops.confirmDelete", { name: h.name })),
      );
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="props" data-nova-anchor="a.hoops.panel">
      {list.length === 0 && <p className="hint">{t("a.hoops.none")}</p>}
      {list.map((h) => (
        <div key={h.id} className="row">
          <label title={`${h.width} × ${h.height} mm`}>
            {h.id === current ? "● " : ""}
            {h.name} · {h.width} × {h.height} mm
            {h.kind === "cap" ? ` · ${t("a.hoops.kind.cap")}` : ""}
          </label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              className="btn ghost"
              data-nova-anchor="a.hoops.use"
              onClick={() =>
                runCommand("a.hoop.select", { source: "user", id: h.id })
              }
            >
              {t("a.hoops.use")}
            </button>
            <button className="btn ghost" onClick={() => setDraft({ ...h })}>
              {t("a.hoops.edit")}
            </button>
            <button className="btn ghost" onClick={() => void remove(h)}>
              {t("a.hoops.delete")}
            </button>
          </div>
        </div>
      ))}
      <Row label={t("a.hoops.name")}>
        <input
          className="input"
          data-nova-anchor="a.hoops.name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Row>
      <Row label={t("a.hoops.width")}>
        <Num
          value={draft.width}
          unit="mm"
          step={5}
          min={10}
          onChange={(v) => set({ width: v })}
        />
      </Row>
      <Row label={t("a.hoops.height")}>
        <Num
          value={draft.height}
          unit="mm"
          step={5}
          min={10}
          onChange={(v) => set({ height: v })}
        />
      </Row>
      <Row label={t("a.hoops.shape")}>
        <select
          className="select"
          value={draft.shape}
          onChange={(e) => set({ shape: e.target.value as Draft["shape"] })}
        >
          <option value="rect">{t("a.hoops.shape.rect")}</option>
          <option value="oval">{t("a.hoops.shape.oval")}</option>
        </select>
      </Row>
      <Row label={t("a.hoops.kind")}>
        <select
          className="select"
          data-nova-anchor="a.hoops.kind"
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}
        >
          <option value="flat">{t("a.hoops.kind.flat")}</option>
          <option value="cap">{t("a.hoops.kind.cap")}</option>
        </select>
      </Row>
      <button
        className="btn primary"
        data-nova-anchor="a.hoops.save"
        disabled={!draft.name.trim()}
        onClick={() => void save()}
      >
        {draft.id ? t("a.hoops.update") : t("a.hoops.add")}
      </button>
      {draft.id && (
        <button className="btn ghost" onClick={() => setDraft(empty())}>
          {t("a.hoops.cancel")}
        </button>
      )}
    </div>
  );
}
