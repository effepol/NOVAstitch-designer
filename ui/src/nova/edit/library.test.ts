// Module f — Library: f.library.insert({itemId, size, cornerRadius?, borderWidth?})
// and the library itself (ui/src/nova/library/: SVG or .nsd, licence declared in the manifest).

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useStore, emptyDoc } from "../../store";
import type { StitchDocument } from "../../types";
import { getCommand, runCommand } from "../core/commands";
import { boundsOfPoints, flatten, objectBounds } from "../../lib/geometry";
import { libraryItems, parseSvgShape, setLibrary, type LibraryManifest } from "./library";
import { installLibrary } from "./installLibrary";

const lib = (f: string) => path.resolve(process.cwd(), "src", "nova", "library", f);
const manifest = JSON.parse(readFileSync(lib("manifest.json"), "utf8")) as LibraryManifest;
const files: Record<string, string> = Object.fromEntries(manifest.items.map((i) => [i.file, readFileSync(lib(i.file), "utf8")]));

// the library as it is shipped
check(manifest.schemaVersion === 1 && manifest.items.length >= 5, `the manifest lists the shapes (${manifest.items.length})`);
for (const i of manifest.items) {
  check(/^[A-Za-z0-9.+-]+$/.test(i.license ?? "") && !!i.author && !!i.name?.it && !!i.name?.en, `${i.id}: licence, author and names declared`);
  check(i.kind === "svg" || i.kind === "nsd", `${i.id}: an SVG or a .nsd`);
  const shape = i.kind === "svg" ? parseSvgShape(files[i.file]) : null;
  check(!!shape && shape.length > 0 && shape.every((sp) => sp.closed && sp.nodes.length >= 3), `${i.id}: the file reads as closed shapes`);
}
check(new Set(manifest.items.map((i) => i.id)).size === manifest.items.length, "every item has its own id");

// an item without a licence is left out
setLibrary({ schemaVersion: 1, items: [...manifest.items, { id: "nolicence", kind: "svg", file: "shapes/rect.svg", name: { it: "x", en: "x" }, author: "x" } as never] }, files);
check(!libraryItems().some((i) => i.id === "nolicence") && libraryItems().length === manifest.items.length, "an item without a declared licence is not in the library");

const off = installLibrary({ manifest, files });
check(!!getCommand("f.library.insert"), "f.library.insert is registered");
const s = () => useStore.getState();
const start = () => s().setDoc({ ...emptyDoc(), hoop: { name: "H", width: 200, height: 200 }, threads: [{ id: "t1", name: "Nero", color: "#000000", brand: "", code: "" }], objects: [] } as StitchDocument);

// a rounded rectangle 80 × 50 with a 2 mm border
start();
let past = s().past.length;
runCommand("f.library.insert", { itemId: "rect", size: [80, 50], cornerRadius: 6, borderWidth: 2 });
const [fill, border] = s().doc.objects;
check(s().past.length === past + 1 && s().doc.objects.length === 2, "one undo step: the shape and its border");
check(fill?.stitch.type === "fill" && border?.stitch.type === "satin" && border.stitch.width === 2, "a fill, then a satin border 2 mm wide");
const b = boundsOfPoints(fill.paths.flatMap((p) => flatten(p, 16)))!;
check(Math.abs(b.w - 80) < 0.01 && Math.abs(b.h - 50) < 0.01, `the shape is 80 × 50 mm (${b.w.toFixed(2)} × ${b.h.toFixed(2)})`);
check(Math.abs(b.x + b.w / 2 - 100) < 0.01 && Math.abs(b.y + b.h / 2 - 100) < 0.01, "in the middle of the hoop");
const corner = fill.paths[0].nodes.some((n) => Math.abs(n.p[0] - b.x) < 0.01 && Math.abs(n.p[1] - b.y) < 0.01);
check(!corner && fill.paths[0].nodes.length === 8, "the corners are rounded (no node on the square corner)");
check(JSON.stringify(border.paths) === JSON.stringify(fill.paths), "the border runs on the outline");
check(!!fill.group && fill.group === border.group, "shape and border move together (one group)");
check(fill.thread !== border.thread && s().doc.threads.length === 3, "two threads of their own, added to the design");
check(s().doc.objects.every((o) => !o.clone), "no clone");

// no border, not a rectangle: the radius is ignored
start();
runCommand("f.library.insert", { itemId: "shield", size: [60, 72] });
const shield = s().doc.objects;
const sb = objectBounds(shield[0])!;
check(shield.length === 1 && shield[0].stitch.type === "fill" && Math.abs(sb.w - 60) < 0.05 && Math.abs(sb.h - 72) < 0.05, `the shield alone, 60 × 72 (${sb.w.toFixed(2)} × ${sb.h.toFixed(2)})`);
check(shield[0].paths[0].nodes.some((n) => n.i || n.o), "the curves of the SVG are kept (bezier handles)");

// bad requests change nothing
start();
past = s().past.length;
runCommand("f.library.insert", { itemId: "nothing", size: [50, 50] });
runCommand("f.library.insert", { itemId: "circle", size: [0, 50] });
runCommand("f.library.insert", { itemId: "circle", size: [50, 50], borderWidth: -1 });
check(s().past.length === past && s().doc.objects.length === 0, "unknown item, zero size, negative border: no change");

// a .nsd item: its objects, scaled to the size, threads merged
const nsd = JSON.stringify({
  version: 1,
  name: "Stella",
  threads: [{ id: "t1", name: "Oro", color: "#d4a017", brand: "", code: "" }],
  objects: [{ id: "a", name: "Stella", thread: "t1", visible: true, locked: false, paths: [{ closed: true, nodes: [{ p: [0, 0] }, { p: [10, 0] }, { p: [10, 20] }] }], stitch: { type: "running", length: 2.5, tolerance: 0.2, repeats: 1, beanRepeats: 0 }, trimAfter: false, stopAfter: false }],
  nova: { schemaVersion: 1 },
});
off();
const off2 = installLibrary({ manifest: { schemaVersion: 1, items: [{ id: "star", kind: "nsd", file: "star.nsd", name: { it: "Stella", en: "Star" }, license: "CC0-1.0", author: "test" }] }, files: { "star.nsd": nsd } });
start();
runCommand("f.library.insert", { itemId: "star", size: [20, 40], borderWidth: 3 });
const star = s().doc.objects;
const stb = objectBounds(star[0])!;
check(star.length === 1 && star[0].id !== "a" && Math.abs(stb.w - 20) < 0.01 && Math.abs(stb.h - 40) < 0.01, `a .nsd item: its object at 20 × 40, a new id (${stb.w} × ${stb.h})`);
check(s().doc.threads.some((t) => t.color === "#d4a017" && t.id === star[0].thread), "its thread is merged into the design");
off2();
done("module f (library)");
