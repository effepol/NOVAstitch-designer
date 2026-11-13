// Module f: the Library section, at the top of the Patch panel.
// Pick a base shape, its size, corner radius and border, then insert it (f.library.insert).

import { useSyncExternalStore } from "react";
import { runCommand } from "../core/commands";
import { t, useLanguage } from "../core/i18n";
import { Num, Row } from "../../components/ui";
import { useStore } from "../../store";
import { libraryItems, type InsertParams } from "./library";
import "./texts";

let choice: InsertParams = { itemId: "rect", size: [80, 50], cornerRadius: 6, borderWidth: 2 };
const listeners = new Set<() => void>();
const setChoice = (p: Partial<InsertParams>) => {
  choice = { ...choice, ...p };
  for (const fn of [...listeners]) fn();
};
const onChoice = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Insert the chosen shape; the new objects become the selection. */
export function insertChosen(): void {
  const before = new Set(useStore.getState().doc.objects.map((o) => o.id));
  runCommand("f.library.insert", choice);
  const s = useStore.getState();
  const added = s.doc.objects.filter((o) => !before.has(o.id)).map((o) => o.id);
  if (added.length) s.set({ selection: added });
}

export function LibraryPanel() {
  const lang = useLanguage();
  const c = useSyncExternalStore(onChoice, () => choice);
  const items = libraryItems();
  const item = items.find((i) => i.id === c.itemId) ?? items[0];
  return (
    <div data-nova-anchor="f.library.panel">
      <Row label={t("f.library.shape")}>
        <select className="select" data-nova-anchor="f.library.shape" value={item?.id ?? ""} onChange={(e) => setChoice({ itemId: e.target.value })}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name[lang]}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("f.library.width")}>
        <span data-nova-anchor="f.library.size">
          <Num value={c.size[0]} unit="mm" step={1} min={5} onChange={(v) => setChoice({ size: [v, c.size[1]] })} />
        </span>
      </Row>
      <Row label={t("f.library.height")}>
        <Num value={c.size[1]} unit="mm" step={1} min={5} onChange={(v) => setChoice({ size: [c.size[0], v] })} />
      </Row>
      {item?.cornerRadius && (
        <Row label={t("f.library.cornerRadius")}>
          <Num value={c.cornerRadius ?? 0} unit="mm" step={0.5} min={0} onChange={(v) => setChoice({ cornerRadius: v })} />
        </Row>
      )}
      <Row label={t("f.library.border")}>
        <span data-nova-anchor="f.library.border">
          <Num value={c.borderWidth ?? 0} unit="mm" step={0.5} min={0} max={12} onChange={(v) => setChoice({ borderWidth: v })} />
        </span>
      </Row>
      <p className="hint">{t("f.library.borderHint")}</p>
      <button className="btn primary" data-nova-anchor="f.library.insert" disabled={!item} onClick={() => insertChosen()}>
        {t("f.library.insert")}
      </button>
      {item && <p className="hint">{t("f.library.licence", { licence: item.license, author: item.author })}</p>}
    </div>
  );
}
