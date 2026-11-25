# Command line

NOVAstitch Designer includes a small command-line tool, `novastitch`, that uses the same stitch engine as the editor (Filum's `filum` command, renamed). It's handy for converting a folder of files, checking designs in a script, or digitizing in bulk.

## Install

Build it from the repository (see [Building from source](Building-from-Source.md)):

```bash
cargo build -p filum-cli --release
# the program is target/release/novastitch
```

Or run it straight through Cargo: `cargo run -p filum-cli -- <command>`.

## Commands

```text
novastitch convert <in> <out>
novastitch info <file>
novastitch optimize <in> <out>
novastitch digitize <image> <out> [--colors N] [--width MM]
novastitch formats
```

The file extension decides the format, both for reading and for writing.

### convert

Converts between any formats NOVAstitch Designer can read and write. Projects (`.nsd`, `.filum`) are read, not written: open and save them in the editor, which keeps every field. For example:

```bash
novastitch convert design.svg design.pes        # Ink/Stitch SVG → Brother PES
novastitch convert logo.dst logo.svg        # machine file → Ink/Stitch SVG
novastitch convert stemma.nsd stemma.dst    # project → machine file
```

### info

Prints the size, stitch count, colours, trims, jumps, thread use and running time:

```text
$ novastitch info cactus.pes
Design      cactus
Objects     7
Size        60.4 × 68.6 mm
Stitches    10394
Colours     7 (6 changes)
Trims       9   Jumps 9
Thread      52.0 m top + 33.8 m bobbin
Run time    15m 06s @ 800 spm
   1. Beige                #efe3b9    4871 st  24.4 m
   2. Leaf Green           #66ba49    1951 st  9.8 m
   3. Tangerine            #fe9e32    1350 st  6.8 m
   …
```

The thread names here are Brother's: by default a PES file stores its colours as entries of Brother's thread table, which every Brother machine reads (see *PES version* in [Export and print](Export-and-Print.md)).

> **Where did my colours go?** Some formats, such as DST, store only the stitches and the colour changes, not the thread colours. `info` on a DST file shows placeholder colours. Use PES, JEF, VP3 or a `.nsd` project to keep the real threads.

### optimize

Reorders the objects for fewer colour changes and less travel, without changing which object sits on top, then saves the result:

```text
$ novastitch optimize cactus.pes cactus-optimised.pes
colour changes 6 → 5, travel 131 → 202 mm
```

Colour changes cost far more time than a few centimetres of travel, so the optimiser trades one for the other when it has to.

### digitize

Auto-digitizes a picture with the default settings:

```text
$ novastitch digitize cactus.png cactus.pes --colors 6 --width 80
Design      Digitized
Objects     11
Size        60.4 × 68.6 mm
Stitches    10439
Colours     7 (6 changes)
…
```

- `--colors N` sets the number of thread colours to reduce the picture to.
- `--width MM` sets the width of the result in millimetres.

The hoop is sized to fit the design. For presets, line art, AI helpers or cross stitch, use the digitizer in the editor ([Auto-digitize](Auto-Digitize.md)).

### formats

Lists every format, with whether it can be read, written, or both:

```text
$ novastitch formats
dst          Tajima Embroidery Format     read write
pes          Brother Embroidery Format    read write
jef          Janome Embroidery Format     read write
…
```

## Batch example

Convert every PES file in a folder to DST:

```bash
for f in *.pes; do novastitch convert "$f" "${f%.pes}.dst"; done
```
