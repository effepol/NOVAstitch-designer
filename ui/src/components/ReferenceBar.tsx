// Floating bar while a reference picture is adjusted on the canvas: opacity,
// behind / over the stitches, grey, mirror, size, fit, lock, digitize, delete.

import { Check, FlipHorizontal2, Lock, Maximize, RotateCcw, Trash2 } from "lucide-react";
import { Digitize } from "../icons/stitch";
import { pending } from "../lib/actions";
import { fitReferenceToHoop, referenceBytes, removeReference, updateReference } from "../lib/references";
import { useStore } from "../store";
import { Grip, Num, useMovable } from "./ui";
import { t } from "../nova/i18n/filum";

export function ReferenceBar({ id }: { id: string }) {
  const r = useStore((s) => s.doc.references?.find((x) => x.id === id));
  const mv = useMovable("refbar");
  if (!r) return null;
  const set = (patch: Parameters<typeof updateReference>[1]) => updateReference(id, patch);
  const done = () => useStore.getState().set({ refEdit: null });
  // live while dragging the slider, one undo step at the end
  const opacityLive = (v: number) => updateReference(id, { opacity: v / 100 }, true);
  const aspect = r.width / r.height;
  return (
    <div className="ref-bar" onPointerDown={(e) => e.stopPropagation()} style={{ transform: mv.moved ? `translate(${mv.off[0]}px, ${mv.off[1]}px)` : undefined }} data-movable>
      <Grip grip={mv.grip} vertical />
      <span className="ref-name" title={r.name}>
        {r.name}
      </span>
      <label className="ref-field" title={t("filum.barre.opacity")}>
        <input
          type="range"
          min={5}
          max={100}
          step={1}
          value={Math.round(r.opacity * 100)}
          // one undo step per drag or key press; a click that changes nothing leaves none
          onPointerDown={() => useStore.getState().checkpoint()}
          onPointerUp={() => useStore.getState().dropCheckpoint()}
          onKeyDown={(e) => {
            if (!e.repeat && /^(Arrow|Page|Home|End)/.test(e.key)) useStore.getState().checkpoint();
          }}
          onKeyUp={() => useStore.getState().dropCheckpoint()}
          onChange={(e) => opacityLive(+e.target.value)}
        />
        <span className="stat">{Math.round(r.opacity * 100)} %</span>
      </label>
      <div className="seg" role="group" aria-label={t("filum.barre.placement")}>
        <button className={r.placement === "behind" ? "on" : ""} onClick={() => set({ placement: "behind" })} title={t("filum.barre.behind_the_stitches")}>
          {t("filum.barre.behind")}
        </button>
        <button className={r.placement === "over" ? "on" : ""} onClick={() => set({ placement: "over" })} title={t("filum.barre.over_the_stitches_like_tracing")}>
          {t("filum.barre.over")}
        </button>
      </div>
      <button className={`icon-btn ${r.grayscale ? "on" : ""}`} onClick={() => set({ grayscale: !r.grayscale })} title={t("filum.barre.grey_thread_colours_stand_out")}>
        <span className="ref-grey" />
      </button>
      <button className={`icon-btn ${r.flip ? "on" : ""}`} onClick={() => set({ flip: !r.flip })} title={t("filum.barre.mirror")}>
        <FlipHorizontal2 size={15} />
      </button>
      <div className="vsep" />
      <label className="ref-field" title={t("filum.barre.width_keeps_the_proportions")}>
        W
        <Num
          value={r.width}
          unit="mm"
          step={1}
          min={1}
          digits={1}
          onChange={(w) => set({ width: w, height: w / aspect, x: r.x + (r.width - w) / 2, y: r.y + (r.height - w / aspect) / 2 })}
        />
      </label>
      <label className="ref-field" title={t("filum.barre.height_keeps_the_proportions")}>
        H
        <Num
          value={r.height}
          unit="mm"
          step={1}
          min={1}
          digits={1}
          onChange={(h) => set({ height: h, width: h * aspect, x: r.x + (r.width - h * aspect) / 2, y: r.y + (r.height - h) / 2 })}
        />
      </label>
      <button className="icon-btn" onClick={() => fitReferenceToHoop(id)} title={t("filum.barre.fit_the_hoop")}>
        <Maximize size={15} />
      </button>
      <button className="icon-btn" onClick={() => set({ rotation: 0 })} disabled={!r.rotation} title={t("filum.barre.straighten_rotation", { rotation: r.rotation })}>
        <RotateCcw size={15} />
      </button>
      <div className="vsep" />
      <button
        className="icon-btn"
        title={t("filum.barre.auto_digitize_this_picture")}
        onClick={async () => {
          pending.image = await referenceBytes(r);
          useStore.getState().set({ refEdit: null });
          useStore.getState().setDialog("digitize");
        }}
      >
        <Digitize size={15} />
      </button>
      <button
        className="icon-btn"
        title={t("filum.barre.lock_the_picture_stays_put")}
        onClick={() => {
          set({ locked: true });
          done();
        }}
      >
        <Lock size={15} />
      </button>
      <button className="icon-btn" title={t("filum.barre.remove_the_picture_del")} onClick={() => removeReference(id)}>
        <Trash2 size={15} />
      </button>
      <button className="btn sm primary" onClick={done} title={t("filum.barre.done_enter")}>
        <Check size={14} />{t("filum.barre.done_2")}
      </button>
    </div>
  );
}
