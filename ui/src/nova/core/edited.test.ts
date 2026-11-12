// Contract tests 0.4 and 0.5: the record of manual edits (nova.edited).

import { check, done } from "./testkit";
import { useStore } from "../../store";
import { registerCommand, runCommand } from "./commands";
import { setModeSource } from "./mode";
import type { DesignObject, StitchDocument } from "../../types";
import { rotateAbout, transformObject } from "../../lib/geometry";

const rail = (y: number) => ({ closed: false, nodes: [{ p: [0, y] as [number, number] }, { p: [30, y] as [number, number] }] });
const satin = {
  id: "s",
  name: "Satin",
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [rail(0), rail(4)],
  stitch: { type: "satin", method: "satin", spacing: 0.4, width: 4, pullComp: 0, pullCompPct: 0, maxStitchLength: 12, shortStitchInset: 0, centerWalk: false, contourUnderlay: false, contourInset: 0.4, zigzagUnderlay: false, zigzagUnderlaySpacing: 3, zigzagUnderlayInset: 0.4, swapRails: false, reverse: false },
} as unknown as DesignObject;
const fresh = (): void => {
  const s = useStore.getState();
  s.setDoc({ ...s.doc, objects: [satin] }, { history: false });
};
const edited = () => useStore.getState().doc.objects[0].nova?.edited ?? [];

// 0.4 — Filum's own panel (StitchOptions → updateStitch) changes the satin spacing
fresh();
useStore.getState().updateStitch("s", { spacing: 0.3 });
check(edited().includes("stitch.spacing"), `0.4 spacing changed in Filum's panel → nova.edited has stitch.spacing (got ${JSON.stringify(edited())})`);

// …the same through the panel's slider (checkpoint + live updates)
fresh();
useStore.getState().checkpoint();
useStore.getState().updateStitch("s", { spacing: 0.35 }, true);
check(edited().includes("stitch.spacing"), "0.4 the same with the slider dragged (live update)");

// …a lock-in / lock-out change is a manual edit too
fresh();
useStore.getState().updateObject("s", { ties: "start" });
check(edited().includes("ties"), "0.4 ties changed by hand → nova.edited has ties");

// …coordinates are not parameters: moving the shape, its guides or a fill's centre records nothing (decision 4, 12/11)
fresh();
useStore.getState().updateStitch("s", { guides: [[[10, -1], [10, 5]]] } as never);
check(edited().length === 0, "0.4 adding a direction guide records nothing");

// …a turned fill records stitch.angle (decision 4, 12/11)
{
  const s = useStore.getState();
  const fill = { ...satin, id: "f", stitch: { type: "fill", method: "radial", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, center: [0.5, 0.5] } } as unknown as DesignObject;
  s.setDoc({ ...s.doc, objects: [fill] }, { history: false });
  s.commit((d) => ({ ...d, objects: d.objects.map((o) => transformObject(o, rotateAbout(30, 15, 2), 30)) }));
  const e = useStore.getState().doc.objects[0].nova?.edited ?? [];
  check(JSON.stringify(e) === JSON.stringify(["stitch.angle"]), `0.4 turning a fill records stitch.angle and not its centre (got ${JSON.stringify(e)})`);
}

// …moving the object is not a parameter edit
fresh();
useStore.getState().commit((d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, paths: o.paths.map((p) => ({ ...p, nodes: p.nodes.map((n) => ({ p: [n.p[0] + 5, n.p[1]] as [number, number] })) })) })) }));
check(edited().length === 0, "0.4 moving the shape records nothing");

// 0.5 — a system command (a fabric preset) changing the same spacing records nothing
registerCommand<{ spacing: number }>({
  id: "test.preset",
  label: { it: "Preset di prova", en: "Test preset" },
  system: true,
  apply: (doc, p): StitchDocument => ({ ...doc, objects: doc.objects.map((o) => (o.stitch.type === "satin" ? { ...o, stitch: { ...o.stitch, spacing: p.spacing } } : o)) }),
});
fresh();
runCommand("test.preset", { spacing: 0.45 });
const st = useStore.getState().doc.objects[0].stitch;
check(st.type === "satin" && st.spacing === 0.45 && edited().length === 0, `0.5 a system command changes the spacing and nova.edited stays as it was (got ${JSON.stringify(edited())})`);

// …and keeps what was already recorded
fresh();
useStore.getState().updateStitch("s", { spacing: 0.3 });
runCommand("test.preset", { spacing: 0.45 });
check(JSON.stringify(edited()) === JSON.stringify(["stitch.spacing"]), "0.5 an earlier manual edit stays recorded");

// a non-system command records, like Filum's panels
registerCommand<{ width: number }>({
  id: "test.width",
  label: { it: "Larghezza", en: "Width" },
  apply: (doc, p): StitchDocument => ({ ...doc, objects: doc.objects.map((o) => (o.stitch.type === "satin" ? { ...o, stitch: { ...o.stitch, width: p.width } } : o)) }),
});
fresh();
runCommand("test.width", { width: 3 });
check(edited().includes("stitch.width"), "0.4 a command not marked system records its change");

// only in Studio: in Assisted nothing is recorded, and what Studio recorded stays
fresh();
useStore.getState().updateStitch("s", { spacing: 0.3 });
setModeSource(() => "assisted");
useStore.getState().updateStitch("s", { width: 3 });
check(JSON.stringify(edited()) === JSON.stringify(["stitch.spacing"]), "0.4 in Assisted a manual change is not recorded; Studio's record stays");
setModeSource(null);

done("manual-edit record");
