// Lock stitch styles (Ink/Stitch lock_stitch.py) with small previews drawn
// from the same shapes the engine uses (crates/core/src/locks.rs).

import { t } from "../nova/i18n/filum";
import type { LockStyle } from "../types";

export const LOCKS: { id: LockStyle; label: string; d: string; hint: string }[] = [
  { id: "halfStitch", get label() { return t("filum.pannelli.half_stitch"); }, d: "M 0,0 0,0.75 0,1.5 0,0.75 0,0", get hint() { return t("filum.pannelli.half_a_stitch_back_and"); } },
  { id: "backForth", get label() { return t("filum.pannelli.back_and_forth"); }, d: "M 0,0 0,0.7 0,1.4 0,0.7", get hint() { return t("filum.pannelli.back_and_forth_over_a"); } },
  { id: "arrow", get label() { return t("filum.pannelli.arrow"); }, d: "M 0.5,0.3 0.3,1.31 -0.11,0.68 H 0.9 L 0.5,1.31 0.4,0.31 V 0.31", get hint() { return t("filum.pannelli.arrow_shape"); } },
  { id: "bowtie", get label() { return t("filum.pannelli.bowtie"); }, d: "M 0,0 -0.39,0.97 0.3,0.03 0.14,1.02 0,0", get hint() { return t("filum.pannelli.bowtie_shape"); } },
  { id: "cross", get label() { return t("filum.pannelli.cross"); }, d: "M 0,0 -0.7,-0.7 0.7,0.7 0,0 -0.7,0.7 0.7,-0.7 0,0", get hint() { return t("filum.pannelli.cross_over_the_lock_point"); } },
  { id: "star", get label() { return t("filum.pannelli.star"); }, d: "M 0.67,-0.2 C 0.27,-0.06 -0.22,0.11 -0.67,0.27 L 0.57,0.33 -0.5,-0.27 0,0.67 V 0", get hint() { return t("filum.pannelli.star_shape"); } },
  { id: "simple", get label() { return t("filum.pannelli.simple"); }, d: "M -0.03,0 0.09,0.81 0,1.49 V 0", get hint() { return t("filum.pannelli.a_small_loop_along_the"); } },
  { id: "triangle", get label() { return t("filum.pannelli.triangle"); }, d: "M -0.26,0.33 H 0.55 L 0,0.84 V 0", get hint() { return t("filum.pannelli.triangle_shape"); } },
  { id: "zigzag", label: "Zig-zag", d: "M -0.25,0.2 0.17,0.77 -0.22,1.45 0.21,2.05 -0.03,3", get hint() { return t("filum.pannelli.zig_zag_along_the_path"); } },
];

function Preview({ d }: { d: string }) {
  return (
    <svg viewBox="-1.1 -1 2.2 4.2" width="18" height="30" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="0.16" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="0" cy="0" r="0.18" fill="currentColor" />
    </svg>
  );
}

export function LockPicker({ value, onChange }: { value: LockStyle; onChange: (v: LockStyle) => void }) {
  return (
    <div className="lock-picker" role="radiogroup">
      {LOCKS.map((l) => (
        <button key={l.id} className={`lock-chip ${value === l.id ? "on" : ""}`} title={`${l.label}: ${l.hint}`} aria-checked={value === l.id} role="radio" onClick={() => onChange(l.id)}>
          <Preview d={l.d} />
        </button>
      ))}
    </div>
  );
}
