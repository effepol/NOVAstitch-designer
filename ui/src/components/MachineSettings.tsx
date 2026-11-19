// The machine of this design and how it sews: preset, stitch-out (ties,
// lock shapes, trims, stitch lengths) and the time estimate's values. Saved
// with the design, so it lives in the Design tab of the dock (each part is
// a collapsible section there).

import { t } from "../nova/i18n/filum";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cutterOf } from "../lib/cuts";
import { currentPreset, MACHINES, presetById } from "../lib/machines";
import { useStore } from "../store";
import { chooseHoop } from "../nova/core/hoopChoice";
import { LockPicker } from "./LockPicker";
import { FrameButtons, SettingsPresetOptions } from "./MachineOptions";
import { Num, Row, Section as DockSection, Toggle } from "./ui";

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <DockSection title={title} defaultOpen={false}>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </DockSection>
  );
}

export function MachineSettings() {
  const m = useStore((s) => s.doc.machine);
  const hoop = useStore((s) => s.doc.hoop);
  const commit = useStore((s) => s.commit);
  const up = (p: Partial<typeof m>) => commit((d) => ({ ...d, machine: { ...d.machine, ...p } }));
  const { preset, modified } = currentPreset(m);
  const profile = preset && MACHINES.find((x) => x.id === preset.id);
  const apply = (id: string) => {
    const p = presetById(id);
    // the preset's values over the design's own: lock stitches (not part of a
    // preset) stay; a preset without a cutter clears the old one
    if (p) commit((d) => ({ ...d, machine: { ...d.machine, cutter: undefined, cutOver: undefined, ...p.values, profile: p.id } }));
  };
  const fmtField = (w: number, h: number) => `${w / 10} × ${h / 10} cm`;
  const cut = cutterOf(m);
  return (
    <>
      <Section title={t("filum.pannelli.machine")} hint={preset?.hint ?? t("filum.pannelli.your_own_settings_pick_a")}>
        <Row label={t("filum.pannelli.preset")} title={t("filum.pannelli.sets_the_stitch_out_and")}>
          <span className="dz-inline">
            <select className="select" value={preset?.id ?? "custom"} onChange={(e) => apply(e.target.value)}>
              {!preset && <option value="custom">{t("filum.pannelli.custom")}</option>}
              <SettingsPresetOptions />
            </select>
            {preset && modified && (
              <>
                <span className="badge warn" title={t("filum.pannelli.changed_since_the_preset_was")}>
                  {t("filum.pannelli.edited")}
                </span>
                <button className="btn sm" onClick={() => apply(preset.id)} title={t("filum.pannelli.back_to_the_name_settings", { name: preset.name })}>
                  <RotateCcw size={12} />{t("filum.pannelli.reset_2")}
                </button>
              </>
            )}
          </span>
        </Row>
        {profile && (
          <div className="mc-card">
            <dl className="mc-facts">
              <div>
                <dt>{t("filum.pannelli.needles")}</dt>
                <dd>{profile.needles ?? 1}</dd>
              </div>
              <div title={profile.speed?.source}>
                <dt>{t("filum.pannelli.top_speed")}</dt>
                <dd>{profile.speed ? t("filum.pannelli.spm_spm", { spm: profile.speed.spm }) : "—"}</dd>
              </div>
              <div>
                <dt>{t("filum.pannelli.field")}</dt>
                <dd>{fmtField(profile.field.width, profile.field.height)}</dd>
              </div>
              <div>
                <dt>{t("filum.pannelli.reads")}</dt>
                <dd>{profile.formats.map((f) => "." + f.toUpperCase()).join(" ")}</dd>
              </div>
              {profile.maxStitches && (
                <div title={profile.maxStitches.source}>
                  <dt>{t("filum.pannelli.stitches")}</dt>
                  <dd>≤ {profile.maxStitches.value.toLocaleString()}</dd>
                </div>
              )}
              {profile.maxColorChanges && (
                <div title={profile.maxColorChanges.source}>
                  <dt>{t("filum.pannelli.colour_changes")}</dt>
                  <dd>≤ {profile.maxColorChanges.value}</dd>
                </div>
              )}
            </dl>
            {profile.frames.length > 0 && (
              <div className="mc-frames-wrap">
                <span className="mc-label">{t("filum.pannelli.use_a_frame_as_the")}</span>
                <FrameButtons
                  className="mc-frames"
                  frames={profile.frames}
                  isOn={(f) => hoop.width === f.width && hoop.height === f.height && (hoop.shape ?? "rect") === (f.shape ?? "rect")}
                  onPick={(f) => chooseHoop({ source: "preset", id: `machine:${profile.id}/${f.id}` }, () => commit((d) => ({ ...d, hoop: { name: `${profile.brand} ${f.name}`, width: f.width, height: f.height, ...(f.shape ? { shape: f.shape } : {}) } })))}
                />
              </div>
            )}
            {profile.notes && <p className="hint">{profile.notes}</p>}
          </div>
        )}
      </Section>
      <Section title={t("filum.pannelli.stitch_out")}>
        <Row label={t("filum.pannelli.tie_in_tie_off")} title={t("filum.pannelli.lock_stitches_at_the_start")}>
          <Toggle on={m.ties} onChange={(v) => up({ ties: v })} />
        </Row>
        {m.ties && (
          <>
            <Row label={t("filum.pannelli.start_lock")} title={t("filum.pannelli.lock_stitch_shape_where_a")}>
              <LockPicker value={m.lockStart ?? "halfStitch"} onChange={(v) => up({ lockStart: v })} />
            </Row>
            <Row label={t("filum.pannelli.end_lock")} title={t("filum.pannelli.lock_stitch_shape_where_a_2")}>
              <LockPicker value={m.lockEnd ?? "halfStitch"} onChange={(v) => up({ lockEnd: v })} />
            </Row>
            {[m.lockStart, m.lockEnd].some((l) => l && l !== "halfStitch" && l !== "backForth") && (
              <Row label={t("filum.pannelli.lock_size")} title={t("filum.pannelli.size_of_the_shaped_locks")}>
                <Num value={m.lockScale ?? 100} unit="%" step={10} min={30} max={300} digits={0} onChange={(v) => up({ lockScale: v })} />
              </Row>
            )}
            {[m.lockStart, m.lockEnd].includes("backForth") && (
              <Row label={t("filum.pannelli.lock_length")} title={t("filum.pannelli.length_of_the_back_and")}>
                <Num value={m.lockLength ?? 0.7} unit="mm" step={0.1} min={0.2} max={3} onChange={(v) => up({ lockLength: v })} />
              </Row>
            )}
          </>
        )}
        <Row label={t("filum.pannelli.trim_jumps_over")} title={t("filum.pannelli.longer_travel_becomes_tie_off")}>
          <Num value={m.trimDistance} unit="mm" step={0.5} min={0.5} onChange={(v) => up({ trimDistance: v })} />
        </Row>
        <Row label={t("filum.pannelli.thread_cutter")} title={t("filum.pannelli.what_the_machine_cuts_jumps")}>
          <select
            className="select"
            value={cut.kind}
            onChange={(e) => {
              const kind = e.target.value as typeof cut.kind;
              up(kind === "trims" ? { cutter: undefined, cutOver: undefined } : { cutter: kind, cutOver: kind === "jumps" ? cut.over : undefined });
            }}
          >
            <option value="trims">{t("filum.pannelli.cuts_every_trim")}</option>
            <option value="jumps">{t("filum.pannelli.cuts_longer_jumps_only")}</option>
            <option value="none">{t("filum.pannelli.none_snip_by_hand")}</option>
          </select>
        </Row>
        {cut.kind === "jumps" && (
          <Row label={t("filum.pannelli.cuts_jumps_over")} title={t("filum.pannelli.the_machine_s_jump_stitch")}>
            <Num value={cut.over} unit="mm" step={1} min={0} max={50} digits={0} onChange={(v) => up({ cutOver: v })} />
          </Row>
        )}
        <Row label={t("filum.pannelli.min_stitch")} title={t("filum.pannelli.shorter_stitches_are_dropped")}>
          <Num value={m.minStitch} unit="mm" step={0.05} min={0} onChange={(v) => up({ minStitch: v })} />
        </Row>
        <Row label={t("filum.pannelli.max_stitch_2")} title={t("filum.pannelli.longer_stitches_are_split")}>
          <Num value={m.maxStitch} unit="mm" step={0.5} min={2} max={12.7} onChange={(v) => up({ maxStitch: v })} />
        </Row>
      </Section>
      <Section title={t("filum.pannelli.time_estimates")} hint={t("filum.pannelli.the_rated_top_speed_dense")}>
        <Row label={t("filum.pannelli.speed")}>
          <Num value={m.spm} unit={t("filum.pannelli.spm")} step={50} min={100} digits={0} onChange={(v) => up({ spm: v })} />
        </Row>
        <Row label={t("filum.pannelli.trim_time")}>
          <Num value={m.trimSeconds} unit="s" step={1} min={0} onChange={(v) => up({ trimSeconds: v })} />
        </Row>
        <Row label={t("filum.pannelli.colour_change")}>
          <Num value={m.colorChangeSeconds} unit="s" step={1} min={0} onChange={(v) => up({ colorChangeSeconds: v })} />
        </Row>
      </Section>
    </>
  );
}

