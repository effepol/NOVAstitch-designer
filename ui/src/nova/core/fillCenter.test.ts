// Module 0 (decision 5, 12/11): a fill's centre (stitch.center, relative to the
// shape's box, 0..1) stays on the same point of the shape when it moves or mirrors.

import { check, done } from "./testkit";
import { rotateAbout, scaleAbout, transformObject, translateMat } from "../../lib/geometry";
import type { DesignObject } from "../../types";

const radial = {
  id: "f",
  name: "Radiale",
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [{ closed: true, nodes: [{ p: [10, 10] }, { p: [50, 10] }, { p: [50, 30] }, { p: [10, 30] }] }],
  stitch: { type: "fill", method: "radial", angle: 0, rowSpacing: 0.4, maxStitchLength: 3, center: [0.2, 0.25] },
} as unknown as DesignObject;
const centre = (o: DesignObject) => (o.stitch.type === "fill" ? o.stitch.center : undefined);
const near = (a: number[] | undefined, b: number[]) => !!a && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

check(near(centre(transformObject(radial, translateMat(10, 5))), [0.2, 0.25]), "moving keeps the relative centre (already right in Filum)");
check(near(centre(transformObject(radial, scaleAbout(-1, 1, 30, 20))), [0.8, 0.25]), `a horizontal mirror puts the centre on the mirrored point (got ${JSON.stringify(centre(transformObject(radial, scaleAbout(-1, 1, 30, 20))))})`);
check(near(centre(transformObject(radial, scaleAbout(1, -1, 30, 20))), [0.2, 0.75]), "a vertical mirror too");
check(near(centre(transformObject(radial, scaleAbout(2, 2, 0, 0))), [0.2, 0.25]), "scaling keeps it");
// a quarter turn of the 40×20 box about its centre: the point (18, 15) goes to (35, 8) in a 20×40 box at (20, 0)
check(near(centre(transformObject(radial, rotateAbout(90, 30, 20))), [0.75, 0.2]), `a quarter turn keeps the centre on the same point (got ${JSON.stringify(centre(transformObject(radial, rotateAbout(90, 30, 20))))})`);
check(near(centre(radial), [0.2, 0.25]), "the original object is left untouched");

done("fill centre");
