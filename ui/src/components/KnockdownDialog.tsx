// Knockdown (laydown stitch; knockdown fill in Ink/Stitch): a light net sewn
// first that flattens the pile of towels, fleece and fur so the embroidery
// doesn't sink in. One tool, two scopes:
//
// - Whole design: automatic — the engine lays the net under everything and it
//   follows every edit (a design setting, saved with the design).
// - Under the selection: an ordinary fill object under the selected objects
//   (their outline grown, or a rectangle / circle around them), editable and
//   reorderable like any other object.
//
// Both use the same words: reach, keep holes, stitch length, colour.


import { useState } from "react";
import { defaultDesignOptions } from "../lib/geometry";
import { createKnockdown, DEFAULT_KNOCKDOWN, type JoinStyle, type KnockdownSelectionOptions } from "../lib/knockdown";
import { useStore } from "../store";
import type { DesignOptions } from "../types";
import { Dialog, Num, Row, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t, tn } from "../nova/i18n/filum";

type Scope = "design" | "selection";
let pendingScope: Scope | null = null;

/** Open the knockdown dialog (on the selection when there is one). */
export function openKnockdown(scope?: Scope) {
  pendingScope = scope ?? null;
  useStore.getState().setDialog("knockdown");
}

const KEY = "filum.knockdown";
const loadSelection = (): KnockdownSelectionOptions => {
  try {
    return { ...DEFAULT_KNOCKDOWN, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_KNOCKDOWN;
  }
};

const JOINS = (): [JoinStyle, string][] => [
  ["round", t("filum.finestre.round")],
  ["mitre", t("filum.finestre.mitre")],
  ["bevel", t("filum.finestre.bevel")],
];

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([k, l]) => (
        <button key={String(k)} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ColourRow({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const fabricColor = useStore((s) => s.fabricColor);
  const color = value || fabricColor;
  return (
    <Row label={t("filum.finestre.colour")} title={t("filum.finestre.usually_the_fabric_s_colour")}>
      <div className="kd-color">
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} />
        <button className="btn sm ghost" disabled={color.toLowerCase() === fabricColor.toLowerCase()} title={t("filum.finestre.use_the_fabric_colour")} onClick={() => onChange(fabricColor)}>
          {t("filum.finestre.fabric")}
        </button>
      </div>
    </Row>
  );
}

/** The whole design's knockdown (a design setting: live, no Create). */
export function DesignKnockdownFields({ o, set }: { o: DesignOptions; set: (p: Partial<DesignOptions>) => void }) {
  const fabricColor = useStore((s) => s.fabricColor);
  const on = !!o.knockdown;
  return (
    <>
      <Row label={t("filum.finestre.knockdown")} title={t("filum.finestre.a_light_net_sewn_first")}>
        <Toggle on={on} onChange={(v) => set(v ? { knockdown: true, knockdownColor: o.knockdownColor || fabricColor } : { knockdown: false })} />
      </Row>
      {on && (
        <>
          <Row label={t("filum.finestre.reach")} title={t("filum.finestre.how_far_the_net_reaches")}>
            <Num value={o.knockdownOffset ?? 2} unit="mm" step={0.5} min={0} max={15} onChange={(v) => set({ knockdownOffset: v })} />
          </Row>
          <Row label={t("filum.finestre.keep_holes")} title={t("filum.finestre.leave_the_pile_standing_inside")}>
            <Toggle on={!!o.knockdownHoles} onChange={(v) => set({ knockdownHoles: v })} />
          </Row>
          <Row label={t("filum.finestre.net")} title={t("filum.finestre.one_layer_or_two_crossing")}>
            <Seg
              value={o.knockdownLayers ?? 2}
              onChange={(v) => set({ knockdownLayers: v })}
              options={[
                [1, t("filum.finestre.single")],
                [2, t("filum.finestre.crossed")],
              ]}
            />
          </Row>
          <Row label={t("filum.finestre.spacing")} title={t("filum.finestre.row_distance_of_the_net")}>
            <Num value={o.knockdownSpacing ?? 2} unit="mm" step={0.25} min={0.5} max={6} onChange={(v) => set({ knockdownSpacing: v })} />
          </Row>
          <Row label={t("filum.finestre.stitch_length")} title={t("filum.finestre.long_stitches_lie_over_the")}>
            <Num value={o.knockdownLength ?? 4} unit="mm" step={0.5} min={1} max={8} onChange={(v) => set({ knockdownLength: v })} />
          </Row>
          <Row label={t("filum.finestre.angle")}>
            <Num value={o.knockdownAngle ?? 45} unit="°" step={15} onChange={(v) => set({ knockdownAngle: v })} />
          </Row>
          <ColourRow value={o.knockdownColor ?? ""} onChange={(v) => set({ knockdownColor: v })} />
        </>
      )}
    </>
  );
}

/** A knockdown object under the selection (Ink/Stitch knockdown fill). */
function SelectionKnockdownFields({ o, set }: { o: KnockdownSelectionOptions; set: (p: Partial<KnockdownSelectionOptions>) => void }) {
  return (
    <>
      <Row label={t("filum.finestre.reach")} title={t("filum.finestre.how_far_the_knockdown_reaches")}>
        <Num value={o.offset} unit="mm" step={0.5} min={-50} max={50} onChange={(v) => set({ offset: v })} />
      </Row>
      <Row label={t("filum.finestre.keep_holes")} title={t("filum.finestre.leave_the_pile_standing_inside")}>
        <Toggle on={o.keepHoles} onChange={(v) => set({ keepHoles: v })} />
      </Row>
      <Row label={t("filum.finestre.corners")} title={t("filum.finestre.corner_style_of_the_grown")}>
        <Seg value={o.join} onChange={(v) => set({ join: v })} options={JOINS()} />
      </Row>
      {(o.join === "mitre" || (o.frame === "rect" && o.frameJoin === "mitre")) && (
        <Row label={t("filum.finestre.mitre_limit")} title={t("filum.finestre.sharp_mitred_corners_reaching_further")}>
          <Num value={o.mitreLimit} step={0.5} min={0.1} max={50} onChange={(v) => set({ mitreLimit: v })} />
        </Row>
      )}
      <Row label={t("filum.finestre.shape")} title={t("filum.finestre.follow_the_design_or_a")}>
        <Seg
          value={o.frame}
          onChange={(v) => set({ frame: v })}
          options={[
            ["none", t("filum.finestre.design_2")],
            ["rect", t("filum.finestre.rectangle")],
            ["circle", t("filum.finestre.circle")],
          ]}
        />
      </Row>
      {o.frame !== "none" && (
        <>
          <Row label={t("filum.finestre.shape_margin")} title={t("filum.finestre.margin_between_the_design_s")}>
            <Num value={o.frameOffset} unit="mm" step={0.5} min={0} max={50} onChange={(v) => set({ frameOffset: v })} />
          </Row>
          {o.frame === "rect" && (
            <Row label={t("filum.finestre.shape_corners")}>
              <Seg value={o.frameJoin} onChange={(v) => set({ frameJoin: v })} options={JOINS()} />
            </Row>
          )}
          <Row label={t("filum.finestre.cut_out_design")} title={t("filum.finestre.off_the_whole_rectangle_circle")}>
            <Toggle on={!o.frameOnly} onChange={(v) => set({ frameOnly: !v })} />
          </Row>
        </>
      )}
      <Row label={t("filum.finestre.stitch_length")} title={t("filum.finestre.long_stitches_lie_over_the_2")}>
        <Num value={o.stitchLength} unit="mm" step={0.5} min={0.5} max={10} onChange={(v) => set({ stitchLength: v })} />
      </Row>
      <ColourRow value={o.color} onChange={(v) => set({ color: v })} />
    </>
  );
}

export function KnockdownDialog({ onClose }: { onClose: () => void }) {
  const hasSel = useStore((s) => s.selection.length > 0);
  const options = useStore((s) => s.doc.options) ?? defaultDesignOptions();
  const [scope, setScope] = useState<Scope>(() => {
    const p = pendingScope;
    pendingScope = null;
    return p ?? (useStore.getState().selection.length ? "selection" : "design");
  });
  const [kd, setKd] = useState(loadSelection);
  const [busy, setBusy] = useState(false);
  const setSelection = (p: Partial<KnockdownSelectionOptions>) =>
    setKd((v) => {
      const next = { ...v, ...p };
      safeSetItem(KEY, JSON.stringify(next));
      return next;
    });
  const setDesign = (p: Partial<DesignOptions>) => useStore.getState().commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), ...p } }));
  const create = async () => {
    setBusy(true);
    try {
      const n = await createKnockdown(kd);
      if (n) useStore.getState().toast(tn("filum.finestre.knockdown_created", n), "success");
      onClose();
    } catch (e) {
      useStore.getState().toast(String((e as Error).message ?? e), "error");
      setBusy(false);
    }
  };
  return (
    <Dialog
      live
      title={t("filum.finestre.knockdown")}
      onClose={onClose}
      footer={
        scope === "design" ? (
          <>
            <div className="spacer" />
            <button className="btn primary" onClick={onClose}>
              {t("filum.finestre.done")}
            </button>
          </>
        ) : (
          <>
            <div className="spacer" />
            <button className="btn" onClick={onClose}>
              {t("filum.finestre.cancel")}
            </button>
            <button className="btn primary" disabled={!hasSel || busy} onClick={create}>
              {busy ? t("filum.finestre.working") : t("filum.finestre.create_knockdown")}
            </button>
          </>
        )
      }
    >
      <div className="seg seg-full" style={{ marginBottom: 10 }}>
        <button className={scope === "design" ? "on" : ""} onClick={() => setScope("design")} title={t("filum.finestre.automatic_under_everything_following_every")}>
          {t("filum.finestre.whole_design")}
        </button>
        <button className={scope === "selection" ? "on" : ""} onClick={() => setScope("selection")} title={t("filum.finestre.an_editable_object_under_the")}>
          {t("filum.finestre.under_the_selection")}
        </button>
      </div>
      {scope === "design" ? (
        <>
          <DesignKnockdownFields o={options} set={setDesign} />
          <p className="hint">{t("filum.finestre.saved_with_the_design_and")}</p>
        </>
      ) : (
        <>
          {!hasSel && <p className="hint warn">{t("filum.finestre.select_the_objects_to_knock")}</p>}
          <SelectionKnockdownFields o={kd} set={setSelection} />
          <p className="hint">{t("filum.finestre.an_editable_fill_under_the")}</p>
        </>
      )}
    </Dialog>
  );
}
