// Contract test 0.3: moving a satin moves its direction guides (stitch.guides) too.

import { check, done } from "./testkit";
import { transformObject, translateMat, scaleAbout } from "../../lib/geometry";
import type { DesignObject, Vec2 } from "../../types";

const rail = (a: Vec2, b: Vec2) => ({ closed: false, nodes: [{ p: a }, { p: b }] });
const satin = {
  id: "s",
  name: "Satin",
  thread: "t1",
  visible: true,
  locked: false,
  trimAfter: false,
  stopAfter: false,
  paths: [rail([0, 0], [30, 0]), rail([0, 4], [30, 4])],
  stitch: { type: "satin", method: "satin", spacing: 0.4, width: 4, swapRails: false, reverse: false, guides: [[[10, -1], [10, 5]]] },
} as unknown as DesignObject;

const moved = transformObject(satin, translateMat(10, 0));
const g = moved.stitch.type === "satin" ? moved.stitch.guides : undefined;
check(JSON.stringify(g) === JSON.stringify([[[20, -1], [20, 5]]]), `0.3 guide [[10,-1],[10,5]] moved by (10,0) → [[20,-1],[20,5]] (got ${JSON.stringify(g)})`);
check(satin.stitch.type === "satin" && JSON.stringify(satin.stitch.guides) === JSON.stringify([[[10, -1], [10, 5]]]), "0.3 the original object is left untouched");

// the same matrix as the rails: a mirror reflects the guides about the same axis
const mirrored = transformObject(satin, scaleAbout(-1, 1, 15, 0));
const gm = mirrored.stitch.type === "satin" ? mirrored.stitch.guides : undefined;
check(JSON.stringify(gm) === JSON.stringify([[[20, -1], [20, 5]]]), `0.3 a mirror about x = 15 reflects the guide with the rails (got ${JSON.stringify(gm)})`);

// a satin without guides keeps having none
const plain = transformObject({ ...satin, stitch: { ...satin.stitch, guides: undefined } } as DesignObject, translateMat(5, 5));
check(plain.stitch.type === "satin" && plain.stitch.guides === undefined, "0.3 a satin without guides gets none");

done("transform");
