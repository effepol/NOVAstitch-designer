// `novastitch convert` (module 0, request of 25/11, project NSD): a .nsd with a
// satin over foam, a layered 3D, a join link, a jump link and lock stitches,
// converted to DST on the command line, gives the same stitches as the export
// from the interface (the export dialog's options, the engine in WebAssembly).

import { check, done } from "./testkit";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { emptyDoc } from "../../store";
import { defaultFill, defaultRunning, defaultSatin } from "../../lib/geometry";
import type { DesignObject, ExportOptions, StitchDocument, SubPath, Vec2 } from "../../types";
import { nsdText } from "../format/serialize";
import { defaultFoam } from "../3d/foam";
import { toLayered3d } from "../3d/layered3d";

const root = path.resolve(process.cwd(), "..");
// the node typings of the project know only part of child_process: the full call, typed here
const run = execFileSync as unknown as (file: string, args: string[], opts: { cwd: string; encoding?: "utf8"; stdio?: "inherit" | "pipe" }) => string;
const platform = (globalThis as unknown as { process: { platform: string } }).process.platform;
initSync({ module: readFileSync(path.join(process.cwd(), "src", "wasm", "pkg", "filum_wasm_bg.wasm")) });
const engine = new StitchEngine();

const line = (a: Vec2, b: Vec2): SubPath[] => [{ closed: false, nodes: [{ p: a }, { p: b }] }];
const rect = (x: number, y: number, w: number, h: number): SubPath[] => [{ closed: true, nodes: ([[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as Vec2[]).map((p) => ({ p })) }];
const obj = (id: string, thread: string, paths: SubPath[], stitch: unknown, more: Partial<DesignObject> = {}): DesignObject => ({ id, name: id, thread, visible: true, locked: false, trimAfter: false, stopAfter: false, paths, stitch: stitch as DesignObject["stitch"], ...more });

const foam = obj("schiuma", "T1", line([10, 10], [60, 10]), { type: "satin", ...defaultSatin(), width: 5, foam: defaultFoam() }, { ties: "both", lock: { start: "bowtie", end: "star" } });
const layered = obj("strati", "T2", line([10, 30], [60, 30]), null);
layered.stitch = { ...(toLayered3d({ ...layered, stitch: { type: "satin", ...defaultSatin(), width: 8 } }) as object), baseThread: "T1" } as DesignObject["stitch"];
const join = obj("unito", "T1", line([10, 50], [60, 50]), { type: "running", ...defaultRunning() }, { link: "join" });
const jump = obj("saltato", "T1", line([70, 50], [90, 50]), { type: "running", ...defaultRunning() }, { link: "jump", ties: "start" });
const fill = obj("riempimento", "T1", rect(10, 60, 30, 20), { type: "fill", ...defaultFill() }, { trimAfter: true, lock: { end: "triangle" } });
const doc: StitchDocument = {
  ...emptyDoc(),
  name: "Stemma",
  threads: [
    { id: "T1", name: "Rosso", color: "#cc0000", brand: "Madeira", code: "1147" },
    { id: "T2", name: "Oro", color: "#c9a227", brand: "Madeira", code: "4" },
  ],
  objects: [foam, layered, join, jump, fill],
};
check(doc.objects.every((o) => o.stitch), "(the design: foam satin, layered 3D, join, jump, a fill with lock stitches)");

// the interface: the export dialog's options for one file (no repeats; PES version 1), the document as the engine gets it
const opts: ExportOptions = { pesVersion: 1, xRepeats: 1, yRepeats: 1, xSpacing: 100, ySpacing: 100 };
const ui = engine.export(JSON.stringify(doc), "dst", JSON.stringify(opts)) as Uint8Array;

// the command line: the .nsd as the editor saves it, `novastitch convert stemma.nsd stemma.dst`
const bin = path.join(root, "target", "debug", platform === "win32" ? "novastitch.exe" : "novastitch");
if (!existsSync(bin)) run("cargo", ["build", "-q", "-p", "filum-cli"], { cwd: root, stdio: "inherit" });
const dir = mkdtempSync(path.join(tmpdir(), "nova-convert-"));
writeFileSync(path.join(dir, "stemma.nsd"), nsdText(doc));
const said = run(bin, ["convert", "stemma.nsd", "stemma.dst"], { cwd: dir, encoding: "utf8" });
const cli = new Uint8Array(readFileSync(path.join(dir, "stemma.dst")));
check(said.includes("wrote stemma.dst"), "novastitch convert stemma.nsd stemma.dst writes the DST");

/** The DST's stitch records (after the 512-byte header): 3 bytes each, to the end mark. */
const records = (b: Uint8Array) => {
  const out: string[] = [];
  for (let i = 512; i + 2 < b.length; i += 3) {
    out.push(`${b[i]},${b[i + 1]},${b[i + 2]}`);
    if (b[i + 2] === 0xf3) break;
  }
  return out;
};
const a = records(ui);
const b = records(cli);
check(a.length > 100 && a[a.length - 1].endsWith(",243"), `the interface's DST: ${a.length} records, ending with the end mark`);
const first = a.findIndex((r, i) => r !== b[i]);
check(a.length === b.length && first === -1, `the same stitches, jumps, trims and colour changes, record by record${first >= 0 ? ` (first difference at record ${first})` : ""}`);
check(ui.length === cli.length && ui.every((v, i) => v === cli[i]), "the same file, byte for byte (header included)");
// the design really has what is checked: colour changes (2 threads, foam's stop) and jumps (the jump link, the trims)
const cc = a.filter((r) => (Number(r.split(",")[2]) & 0xc3) === 0xc3 && !r.endsWith(",243")).length;
const jumps = a.filter((r) => (Number(r.split(",")[2]) & 0xc0) === 0x80).length;
check(cc >= 2 && jumps >= 4, `colour changes and jumps are there (${cc} colour changes or stops, ${jumps} jump records)`);

done("convert da .nsd a DST");
