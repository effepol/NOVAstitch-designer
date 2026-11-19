// Sewing commands of objects (Ink/Stitch commands and per-object params):
// start and end point, trim and stop after, lock stitches, minimum stitch and
// jump. For several objects — a lettering's glyphs, a selection — the
// settings apply to all of them, and "after" means after the last one sewn.

import { t } from "../nova/i18n/filum";
import { useStore } from "../store";
import type { DesignObject } from "../types";
import { Num, Row, Section, Toggle } from "./ui";

/** A value of the object's own, or the machine's (shown dimmed) until set. */
export function OwnValue({ label, title, value, fallback, onChange }: { label: string; title: string; value: number | undefined; fallback: number; onChange: (v: number | undefined) => void }) {
  return (
    <Row label={label} title={title}>
      <span className="dz-inline">
        <span style={{ opacity: value == null ? 0.55 : 1 }}>
          <Num value={value ?? fallback} step={0.1} min={0} max={20} unit="mm" onChange={(v) => onChange(v)} />
        </span>
        {value != null && (
          <button className="btn sm ghost" title={t("filum.pannelli.use_the_machine_setting_again")} onClick={() => onChange(undefined)}>
            {t("filum.pannelli.default")}
          </button>
        )}
      </span>
    </Row>
  );
}

const LOCKS = () => [
  ["both", t("filum.pannelli.both")],
  ["start", t("filum.pannelli.start_2")],
  ["end", "End"],
  ["none", t("filum.pannelli.none")],
] as const;

export function CommandsSection({ objects }: { objects: DesignObject[] }) {
  const machine = useStore((s) => s.doc.machine);
  const order = useStore((s) => s.doc.objects);
  if (!objects.length) return null;
  const one = objects.length === 1 ? objects[0] : null;
  // "after": the last of them in the stitch order
  const last = [...objects].sort((a, b) => order.indexOf(a) - order.indexOf(b)).at(-1)!;
  const ids = new Set(objects.map((o) => o.id));
  const all = (p: Partial<DesignObject>) => useStore.getState().commit((d) => ({ ...d, objects: d.objects.map((o) => (ids.has(o.id) ? { ...o, ...p } : o)) }));
  const ties = objects.every((o) => (o.ties ?? "both") === (objects[0].ties ?? "both")) ? (objects[0].ties ?? "both") : null;
  const same = <T,>(f: (o: DesignObject) => T) => (objects.every((o) => f(o) === f(objects[0])) ? f(objects[0]) : undefined);
  return (
    <Section title={t("filum.pannelli.commands")} defaultOpen={!!(one?.start || one?.end)}>
      {one &&
        (["start", "end"] as const).map((k) => (
          <Row key={k} label={k === "start" ? t("filum.pannelli.start_point") : t("filum.pannelli.end_point")} title={t("filum.pannelli.drag_the_s_e_pins")}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="stat">{one[k] ? `${one[k]![0].toFixed(1)}, ${one[k]![1].toFixed(1)} mm` : k === "start" ? t("filum.pannelli.nearest_the_last_object") : t("filum.pannelli.automatic")}</span>
              {one[k] && (
                <button className="btn sm ghost" onClick={() => useStore.getState().updateObject(one.id, { [k]: undefined })}>
                  {t("filum.pannelli.reset")}
                </button>
              )}
            </span>
          </Row>
        ))}
      <Row label={t("filum.pannelli.trim_after")} title={one ? undefined : t("filum.pannelli.after_the_last_of_them")}>
        <Toggle on={last.trimAfter} onChange={(v) => useStore.getState().updateObject(last.id, { trimAfter: v })} />
      </Row>
      <Row label={t("filum.pannelli.stop_after")} title={t("filum.pannelli.machine_pause") + (one ? "" : t("filum.pannelli.after_the_last_of_them_2"))}>
        <Toggle on={last.stopAfter} onChange={(v) => useStore.getState().updateObject(last.id, { stopAfter: v })} />
      </Row>
      <Row label={t("filum.pannelli.locks")} title={t("filum.pannelli.lock_stitches_where_it_starts")}>
        <div className="seg">
          {LOCKS().map(([v, l]) => (
            <button key={v} className={ties === v ? "on" : ""} onClick={() => all({ ties: v === "both" ? undefined : v })}>
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row label={t("filum.pannelli.force_lock")} title={t("filum.pannelli.lock_the_end_and_the")}>
        <Toggle on={objects.every((o) => !!o.forceLock)} onChange={(v) => all({ forceLock: v || undefined })} />
      </Row>
      <OwnValue
        label={t("filum.pannelli.min_stitch")}
        title={t("filum.pannelli.drop_stitches_shorter_than_this")}
        value={same((o) => o.minStitch)}
        fallback={machine.minStitch}
        onChange={(v) => all({ minStitch: v })}
      />
      <OwnValue
        label={t("filum.pannelli.min_jump")}
        title={t("filum.pannelli.gaps_after_it_up_to")}
        value={same((o) => o.minJump)}
        fallback={machine.trimDistance}
        onChange={(v) => all({ minJump: v })}
      />
    </Section>
  );
}
