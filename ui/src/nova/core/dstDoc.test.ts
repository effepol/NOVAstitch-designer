// docs/dst-export.md (module 0, request of 25/11): the DST export's conventions
// written down, with the same numbers as the code (a change in the code that
// leaves the document behind fails here).

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const doc = read("docs/dst-export.md");
const dst = read("crates/formats/src/dst.rs");
const model = read("crates/core/src/model.rs");
const assemble = read("crates/core/src/assemble.rs");
const machine = model.slice(model.indexOf("impl Default for MachineSettings"), model.indexOf("impl Default for MachineSettings") + 800);
const num = (src: string, re: RegExp) => Number(src.match(re)?.[1]);

check(/max_stitch: 121,/.test(dst) && /max_jump: 121,/.test(dst) && doc.includes("12.1 mm") && doc.includes("121 units"), "longest movement: 121 × 0.1 mm = 12.1 mm");
check(/0\.1 mm/.test(doc) && /y \*\*down\*\*; the y flip happens here/.test(dst) && /\*\*y up\*\*/.test(doc), "0.1 mm, y up (the writer flips y)");
check(num(dst, /const TRIM_AT: usize = (\d+);/) === 3 && /## Trim = 3 jumps/.test(doc) && doc.includes("(+0.2, +0.2), (−0.4, −0.4), (+0.2, +0.2)"), "a trim is 3 jumps: +2, −4, +2 (0.1 mm)");
check(/Cmd::ColorChange \| Cmd::Stop =>/.test(dst) && /## Stop = colour change/.test(doc), "a stop is written as a colour change");
check(num(machine, /trim_distance: ([\d.]+),/) === 3 && doc.includes("3 mm by default"), "trim distance 3 mm");
check(num(assemble, /const VISIBLE_CONNECTION: f64 = ([\d.]+);/) === 2 && doc.includes("longer than\n  2 mm"), "a connection that would show: 2 mm");
check(num(assemble, /const JOIN_STITCH: f64 = ([\d.]+);/) === 2.5 && doc.includes("running\n  stitches of 2.5 mm"), "link join: 2.5 mm running stitches");
check(/ties: true,/.test(machine) && /lock_start: LockStyle::HalfStitch,/.test(machine) && /lock_end: LockStyle::HalfStitch,/.test(machine) && num(machine, /lock_scale: ([\d.]+),/) === 100 && num(machine, /lock_length: ([\d.]+),/) === 0.7 && doc.includes("*half stitch* at the start and at the end") && doc.includes("100 % size") && doc.includes("0.7 mm long"), "lock stitches on: half stitch, 100 %, 0.7 mm");
check(num(machine, /min_stitch: ([\d.]+),/) === 0.3 && doc.includes("0.3 mm by\ndefault") , "minimum stitch 0.3 mm");
check(num(machine, /max_stitch: ([\d.]+),/) === 12.1 && doc.includes("*maximum stitch* (12.1 mm by default)"), "maximum stitch 12.1 mm");
check(doc.includes("`novastitch convert design.nsd design.dst`") && doc.includes("cliConvert.test.ts"), "the command line writes the same file (and the test that checks it)");

check(/## Changes\n/.test(doc) && /Every change to the DST export .* is written down here/s.test(doc) && /\| 25\/11\/2026 \| This document/.test(doc), "a register of the changes to the DST export (every future change is written down there)");

done("documento dell'esportazione DST");
