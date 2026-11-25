# DST export

How NOVAstitch Designer writes a Tajima DST file. The editor's export dialog
and the command line (`novastitch convert design.nsd design.dst`) write the
same file, byte for byte: both use the same engine (`crates/core/src/io.rs`
`export_with`, then `crates/formats/src/dst.rs`). The test
`ui/src/nova/core/cliConvert.test.ts` checks it on a design with a satin over
foam, a layered 3D, a join link, a jump link and lock stitches.

The engine's stitch plan is in millimetres with y pointing down (as on the
canvas). The DST writer turns it into the format's records.

## The file

- **Header**: 512 bytes of text (`LA:` the design's name, at most 16 ASCII
  characters, «Untitled» when empty; `ST:` the number of records; `CO:` colour
  changes and stops together; `+X -X +Y -Y` the extent; `AX AY` the last
  position), then the records, then the end mark `00 00 F3`.
- **Records**: 3 bytes each, a movement relative to the previous point in
  balanced ternary, and its kind (stitch, jump, colour change, end).

## Units and directions

- **0.1 mm**: every position is rounded to a tenth of a millimetre.
- **y up**: DST's y axis points up, the plan's down: the writer flips y
  (`encode_record`). A design looks the same on the machine as in the editor.
- **Origin**: the centre of the design, unless the design sets its own origin
  (`options.origin`, a point in mm): then that point is (0, 0).

## Longest movement: 12.1 mm

One record moves at most 121 units (12.1 mm) in x and in y. Longer
movements are split into equal pieces:

- a **stitch** longer than 12.1 mm becomes several stitches (as Ink/Stitch's
  `sew_to`), so the thread lies along the same line;
- a **jump** longer than 12.1 mm becomes several jumps, and the last one lands
  exactly on the target (Ink/Stitch's `full_jump`).

Before writing, the machine settings' *maximum stitch* (12.1 mm by default)
splits longer stitches and jumps of the plan the same way (`export_plan`).

## Trim = 3 jumps

DST has no trim command. A trim is written as three jumps that leave the needle
where it was: (+0.2, +0.2), (−0.4, −0.4), (+0.2, +0.2) mm. Machines with a
thread cutter recognise them and cut; on reading, three jumps in a row are read
back as a trim (pystitch's `trim_at = 3`).

## Stop = colour change

DST has one command for both: a **colour change** (`00 00 C3`). A machine stop
(*stop after* on an object, the steps of an appliqué, the stop before a foam
satin to lay the foam) is written the same way; the machine stops and waits as
it does for a new thread. The header's `CO:` counts both.

A colour change cuts the thread by itself: no trim is written right before it.
When the design sets a *stop position* (`options.stopPosition`), the frame
moves out to it before every stop and comes back after.

## When the thread is cut

Between two stitch runs (within an object or from one object to the next):

- a gap **longer than the trim distance** (machine settings, 3 mm by default;
  an object can set its own minimum jump) is cut: lock, trim, jump, lock;
- a shorter gap is **sewn through**, unless it would show: a gap longer than
  2 mm between two objects that nothing sewn later covers is cut too;
- **trim after** / **stop after** on an object: always cut after it (and stop);
- **link join** (NOVAstitch): sewn through whatever the distance, in running
  stitches of 2.5 mm, without locks;
- **link jump** (NOVAstitch): locked, a jump, locked; no trim;
- the **end** of the design: lock, a last trim, the end mark.

*trim after* and *stop after* win over a link.

## Lock stitches (ties)

- **On by default** (machine settings `ties`): a tie-in where the needle starts
  after a cut, a jump or a colour change, a tie-off before them.
- **Default shape**: *half stitch* at the start and at the end (Ink/Stitch's
  default), 100 % size; the back-and-forth lock is 0.7 mm long.
- An object can choose its own (`ties`: both, start, end, none; `lock`: the
  shape, size and length at each end), and *force lock* locks the end even
  when no cut follows.
- A sew-through connection and a link join have no locks.

## Shortest stitch

Stitches shorter than the **minimum stitch** (machine settings, 0.3 mm by
default; an object can set its own) are dropped when they change nothing: the
run always lands on its last point and keeps every turn (a fill's step to the
next row).

## Where the values live

| What | Default | Where |
|---|---|---|
| Unit, y flip, 12.1 mm per record | fixed by the format | `crates/formats/src/dst.rs` |
| Trim as 3 jumps | fixed (`TRIM_AT = 3`) | `crates/formats/src/dst.rs` |
| Trim distance | 3 mm | machine settings `trimDistance`, object `minJump` |
| Visible connection | 2 mm | `crates/core/src/assemble.rs` `VISIBLE_CONNECTION` |
| Link join stitch | 2.5 mm | `crates/core/src/assemble.rs` `JOIN_STITCH` |
| Lock stitches | on, half stitch, 100 %, 0.7 mm | machine settings `ties`, `lockStart`, `lockEnd`, `lockScale`, `lockLength` |
| Minimum stitch | 0.3 mm | machine settings `minStitch`, object `minStitch` |
| Maximum stitch | 12.1 mm | machine settings `maxStitch` |

## Changes

Every change to the DST export (the writer, the plan's trims, ties, jumps or
stitch lengths, the defaults above) is written down here, with its date and
pull request, in the same change that makes it (Architect, 25/11).

| Date | Change | Pull request |
|---|---|---|
| 25/11/2026 | This document: the conventions as they are | #95 |
