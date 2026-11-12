// The nova block (contract, section 2): typed in types.ts, and Filum's own
// opening and copying keep it intact, unknown fields included.

import { check, done } from "./testkit";
import { checkDoc } from "../../lib/docCheck";
import { freshCopies } from "../../lib/copies";
import { emptyDoc } from "../../store";
import type { DesignObject, NovaDocument, StitchDocument } from "../../types";

const nova: NovaDocument = {
  schemaVersion: 1,
  app: { name: "NOVAstitch Designer", version: "0.1.0" },
  hoopRef: { id: "u1", name: "Mio 15×25" },
  hoopKind: "flat",
  fabricPreset: null,
  edit: { mirrorPivot: "selection", duplicateOffset: [0, 0] },
  patchGroups: [],
  mode: "studio",
  lesson: null,
  ext: { "org.example.field": 1 },
};
const obj = {
  id: "a", name: "A", thread: "t1", visible: true, locked: false, trimAfter: false, stopAfter: false,
  paths: [{ closed: true, nodes: [{ p: [0, 0] }, { p: [10, 0] }, { p: [10, 10] }] }],
  stitch: { type: "fill", angle: 0, rowSpacing: 0.4, maxStitchLength: 3 },
  nova: { edited: ["stitch.angle", "ties"], foo: 1 },
} as unknown as DesignObject;
const doc = { ...emptyDoc(), threads: [{ id: "t1", name: "T", color: "#000000", brand: "", code: "" }], objects: [obj], nova: { ...nova, foo: 1 } } as StitchDocument;

const opened = checkDoc(JSON.parse(JSON.stringify(doc)), emptyDoc())!.doc;
check(JSON.stringify(opened.nova) === JSON.stringify(doc.nova), "the document's nova block survives opening, unknown fields included");
check(JSON.stringify(opened.objects[0].nova) === JSON.stringify(obj.nova), "an object's nova block survives opening");
check(opened.objects[0].nova?.edited?.join() === "stitch.angle,ties", "nova.edited is read as written");

const copy = freshCopies(doc, doc.objects).objects[0];
check(copy.id !== obj.id && JSON.stringify(copy.nova) === JSON.stringify(obj.nova), "a copy keeps the same nova.edited (f.6)");

const filum = checkDoc(JSON.parse(JSON.stringify({ ...doc, nova: undefined })), emptyDoc())!.doc;
check(filum.nova === undefined, "a Filum file stays without a nova block (module a fills the defaults)");

done("nova block");
