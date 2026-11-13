import { defaultDesignOptions, defaultFill, defaultRunning, defaultSatin, ellipsePath, smoothPath, uid } from "./lib/geometry";
import { emptyDoc, useStore } from "./store";
import type { DesignObject, StitchDocument, StitchParams, SubPath, Thread, Vec2 } from "./types";
import { fit } from "./lib/actions";
// NOVAstitch (modulo i): i nomi del disegno d'esempio nella lingua dell'interfaccia
import { t } from "./nova/i18n/filum";

const C: Vec2 = [50, 50];
const R = 38;

function arc(a0: number, a1: number, r = R, n = 24): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]);
  }
  return out;
}

const ang = (p: Vec2) => Math.atan2(p[1] - C[1], p[0] - C[0]);
const onCircle = (y: number, side: -1 | 1): Vec2 => [C[0] + side * Math.sqrt(R * R - (y - C[1]) ** 2), y];

/** Ridge line from left circle edge to right circle edge, closed along the bottom arc. */
function ridge(yl: number, peaks: Vec2[], yr: number): SubPath {
  const l = onCircle(yl, -1);
  const r = onCircle(yr, 1);
  const top = [l, ...peaks, r];
  const bottom = arc(ang(r), ang(l)).slice(1, -1);
  return { closed: true, nodes: [...top, ...bottom].map((p) => ({ p })) };
}

const poly = (pts: Vec2[], closed = true): SubPath => ({ closed, nodes: pts.map((p) => ({ p })) });

export function sampleDocument(): StitchDocument {
  const threads: Thread[] = [
    { id: "sky", name: t("filum.esempio.filo.sky"), color: "#9fd3ea", brand: "", code: "" },
    { id: "sun", name: t("filum.esempio.filo.sun"), color: "#f2b632", brand: "", code: "" },
    { id: "slate", name: t("filum.esempio.filo.slate"), color: "#5d7fb5", brand: "", code: "" },
    { id: "forest", name: t("filum.esempio.filo.forest"), color: "#2f6b4f", brand: "", code: "" },
    { id: "snow", name: t("filum.esempio.filo.snow"), color: "#fafaf7", brand: "", code: "" },
    { id: "lake", name: t("filum.esempio.filo.lake"), color: "#2f7fc4", brand: "", code: "" },
    { id: "char", name: t("filum.esempio.filo.char"), color: "#353b45", brand: "", code: "" },
    { id: "navy", name: t("filum.esempio.filo.navy"), color: "#1f2a56", brand: "", code: "" },
  ];
  const o = (name: string, thread: string, paths: SubPath[], stitch: StitchParams): DesignObject => ({
    id: uid(),
    name,
    thread,
    visible: true,
    locked: false,
    paths,
    stitch,
    trimAfter: false,
    stopAfter: false,
  });
  const fill = (p: Partial<ReturnType<typeof defaultFill>> = {}): StitchParams => ({ type: "fill", ...defaultFill(), ...p });

  const nearPeaks: Vec2[] = [
    [28, 50],
    [36, 58],
    [47, 43],
    [60, 61],
    [70, 53],
  ];
  const snowA = poly([
    [28, 50],
    [31.2, 53.4],
    [29.6, 52.6],
    [28.1, 54.3],
    [26.4, 52.8],
    [24.6, 54.0],
  ]);
  const snowB = poly([
    [47, 43],
    [50.2, 47.6],
    [48.6, 46.9],
    [47.2, 48.8],
    [45.7, 47.0],
    [43.9, 48.3],
  ]);
  const objects: DesignObject[] = [
    o(t("filum.esempio.oggetto.cielo"), "sky", [ellipsePath(50, 50, R + 0.6, R + 0.6)], fill({ angle: 0, underlayInset: 0.5 })),
    o(t("filum.esempio.oggetto.sole"), "sun", [ellipsePath(64, 36, 10, 10)], fill({ method: "radial", rowSpacing: 0.3, maxStitchLength: 4 })),
    o(
      t("filum.esempio.oggetto.cresta"),
      "slate",
      [
        ridge(
          60,
          [
            [24, 47],
            [32, 52],
            [44, 37],
            [55, 49],
            [66, 42],
            [78, 54],
          ],
          57,
        ),
      ],
      fill({ angle: 35 }),
    ),
    o(t("filum.esempio.oggetto.montagne"), "forest", [ridge(66, nearPeaks, 66)], fill({ angle: -40 })),
    o(t("filum.esempio.oggetto.cime"), "snow", [snowA, snowB], fill({ angle: 60, underlay: false, rowSpacing: 0.3 })),
    // the cloud goes on in the same white straight after the snow caps (one colour change
    // fewer), then the lake
    o(
      t("filum.esempio.oggetto.nuvola"),
      "snow",
      [
        smoothPath(
          [
            [20, 33],
            [23, 29.5],
            [27, 30],
            [29.5, 26.5],
            [34, 27],
            [36.5, 30.5],
            [40, 31],
            [41.5, 33.5],
          ],
          false,
        ),
      ],
      { type: "running", ...defaultRunning(), beanRepeats: 2, length: 1.8 },
    ),
    o(t("filum.esempio.oggetto.lago"), "lake", [ellipsePath(50, 79.5, 21, 4.6)], fill({ method: "spiral", rowSpacing: 0.4, maxStitchLength: 2.5 })),
    o(
      t("filum.esempio.oggetto.uccelli"),
      "char",
      [
        smoothPath(
          [
            [38, 22],
            [40, 20.6],
            [41.6, 22.4],
            [43.2, 20.6],
            [45.2, 22],
          ],
          false,
        ),
        smoothPath(
          [
            [46, 26],
            [47.4, 25],
            [48.6, 26.4],
            [49.8, 25],
            [51.2, 26],
          ],
          false,
        ),
      ],
      { type: "running", ...defaultRunning(), length: 1.2 },
    ),
    o(t("filum.esempio.oggetto.bordo"), "navy", [ellipsePath(50, 50, R + 0.2, R + 0.2), ellipsePath(50, 50, R + 4.4, R + 4.4)], {
      type: "satin",
      ...defaultSatin(),
      contourUnderlay: true,
      centerWalk: false,
      pullComp: 0.25,
    }),
  ];
  // sewn as a production badge: what lies under the objects on top is left out (the sky
  // under the ridges, the ridge under the mountains, the mountains under the lake), with
  // the default 0.6 mm overlap, so the fills don't stack into a stiff, heavy patch
  return { ...emptyDoc(), name: t("filum.esempio.nome"), threads, objects, options: { ...defaultDesignOptions(), removeOverlaps: true } };
}

export function loadSample() {
  const s = useStore.getState();
  s.setDoc(sampleDocument());
  s.set({ saved: true, filePath: null, selection: [] });
  setTimeout(() => fit("hoop"), 0);
}
