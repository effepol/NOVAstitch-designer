// Module n: the «Varietà» list in Filum's tatami and satin sections (module 0's
// hook registerStitchFields): an entry per variety with its picture and name,
// the one in use highlighted; «Casuale» with its ranges and seed; «Bisatin»
// in the satin. Every choice is one undo step (runCommand) and is recorded in
// nova.edited. Not on a satin over foam (n.11).

import { useEffect, useState, useSyncExternalStore } from "react";
import { Num, Row, Toggle } from "../../components/ui";
import { runCommand } from "../core/commands";
import { t, useLanguage } from "../core/i18n";
import type { StitchSectionProps } from "../core/stitchTypes";
import { engine } from "../../engine/client";
import type { StitchParams } from "../../types";
import { reloadVarieties } from "./load";
import { thumbnail, type PlanFn } from "./thumbs";
import {
  BISATIN_KEY,
  NORMAL_ID,
  RANDOM_LENGTHS,
  RANDOM_OFFSETS,
  RANGE_KEYS,
  SEED_KEY,
  bisatinPatch,
  kindOf,
  nextSeed,
  onVarietyList,
  randomOn,
  randomPatch,
  varietyInUse,
  varietyList,
  varietyPatch,
  varietyVersion,
  type Patch,
  type VarietyKind,
} from "./varieties";

/** The pictures come from the engine's export plan (it does not replace the editor's plan). */
const enginePlan: PlanFn = (doc) => engine.exportPlan(doc);

export const SET_COMMAND = "n.variety.set";

function Thumb({ id, kind, patch }: { id: string; kind: VarietyKind; patch: Patch }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    thumbnail(id, kind, patch, enginePlan).then(
      (s) => live && setSvg(s),
      () => {},
    );
    return () => {
      live = false;
    };
    // the picture belongs to the variety: made once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);
  const box = { width: kind === "satin" ? 64 : 48, height: kind === "satin" ? 18 : 48, display: "block" } as const;
  return svg ? <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} style={box} /> : <span style={box} />;
}

export interface Entry {
  id: string;
  name: string;
  patch: Patch;
}

/** The list's entries: «Normale» first, then the library's. */
export function entriesFor(kind: VarietyKind, lang: "it" | "en"): Entry[] {
  return [{ id: NORMAL_ID, name: t("n.normal"), patch: varietyPatch(kind, null) }, ...varietyList(kind).map((v) => ({ id: v.id, name: v.name[lang], patch: varietyPatch(kind, v) }))];
}

export function VarietyList({ kind, st, set }: { kind: VarietyKind; st: StitchParams; set: (p: Patch) => void }) {
  const lang = useLanguage();
  useSyncExternalStore(onVarietyList, varietyVersion, varietyVersion);
  useEffect(() => {
    // a file added to the user's folder becomes an entry
    void reloadVarieties();
  }, []);
  const used = varietyInUse(st, kind);
  return (
    <div data-nova-anchor="n.list" role="listbox" aria-label={t("n.title")} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {entriesFor(kind, lang).map((e) => (
        <button
          key={e.id}
          type="button"
          role="option"
          aria-selected={used === e.id}
          className={`btn sm${used === e.id ? "" : " ghost"}`}
          data-nova-anchor="n.item"
          title={e.id === NORMAL_ID ? t("n.normal.title") : e.name}
          onClick={() => set(e.patch)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "auto", padding: 4, outline: used === e.id ? "2px solid var(--accent)" : undefined }}
        >
          <Thumb id={e.id} kind={kind} patch={e.patch} />
          <span>{e.name}</span>
        </button>
      ))}
      {used === null && <p className="hint">{t("n.custom")}</p>}
    </div>
  );
}

function Range({ value, onChange, min, max, step, digits }: { value: [number, number]; onChange: (v: [number, number]) => void; min: number; max: number; step: number; digits: number }) {
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span className="hint">{t("n.random.min")}</span>
      <Num value={value[0]} step={step} digits={digits} min={min} max={max} onChange={(v) => onChange([v, Math.max(v, value[1])])} />
      <span className="hint">{t("n.random.max")}</span>
      <Num value={value[1]} step={step} digits={digits} min={min} max={max} onChange={(v) => onChange([Math.min(v, value[0]), v])} />
    </span>
  );
}

export function VarietyFields({ o, targets }: StitchSectionProps) {
  const st = o.stitch;
  if (st.type === "satin" && st.foam)
    return (
      <p className="hint" data-nova-anchor="n.foam">
        {t("n.foam")}
      </p>
    );
  const kind = kindOf(st);
  if (!kind) return null;
  const set = (patch: Patch) => runCommand(SET_COMMAND, { ids: targets, patch });
  const s = st as unknown as Record<string, unknown>;
  const [lk, ok] = RANGE_KEYS[kind];
  const lengths = (s[lk] as [number, number] | undefined) ?? RANDOM_LENGTHS;
  const offsets = (s[ok] as [number, number] | undefined) ?? RANDOM_OFFSETS;
  const seed = (s[SEED_KEY[kind]] as number | undefined) ?? 1;
  const random = randomOn(st, kind);
  return (
    <div>
      <Row label={t("n.title")} title={t("n.title.title")}>
        <span />
      </Row>
      <VarietyList kind={kind} st={st} set={set} />
      <Row label={t("n.random")} title={t("n.random.title")}>
        <span data-nova-anchor="n.random">
          <Toggle on={random} onChange={(v) => set(randomPatch(kind, v, lengths, offsets))} title={t("n.random.title")} />
        </span>
      </Row>
      {random && (
        <>
          <Row label={t("n.random.length")}>
            <span data-nova-anchor="n.random.length">
              <Range value={lengths} min={0.5} max={12} step={0.1} digits={1} onChange={(v) => set({ [lk]: v })} />
            </span>
          </Row>
          <Row label={t("n.random.offset")} title={t("n.random.offset.title")}>
            <span data-nova-anchor="n.random.offset">
              <Range value={offsets} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ [ok]: v })} />
            </span>
          </Row>
          <Row label={t("n.seed")}>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <Num value={seed} step={1} digits={0} min={1} max={9973} onChange={(v) => set({ [SEED_KEY[kind]]: v })} />
              <button type="button" className="btn sm" data-nova-anchor="n.seed.new" title={t("n.seed.new.title")} onClick={() => set({ [SEED_KEY[kind]]: nextSeed(seed) })}>
                {t("n.seed.new")}
              </button>
            </span>
          </Row>
        </>
      )}
      {kind === "satin" && (
        <Row label={t("n.bisatin")} title={t("n.bisatin.title")}>
          <span data-nova-anchor="n.bisatin">
            <Toggle on={!!s[BISATIN_KEY]} onChange={(v) => set(bisatinPatch(v))} title={t("n.bisatin.title")} />
          </span>
        </Row>
      )}
    </div>
  );
}
