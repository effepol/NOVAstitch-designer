# Libreria di NOVAstitch Designer / NOVAstitch Designer library

Forme base per patch, inserite con il comando `f.library.insert` (modulo f).
Ogni elemento è elencato in `manifest.json` con la sua licenza; un file senza
licenza dichiarata non entra nella libreria.

Base shapes for patches, inserted with the `f.library.insert` command (module f).
Every item is listed in `manifest.json` with its licence; a file without a
declared licence is not part of the library.

- `kind`: `svg` (one `<path>`, `<rect>`, `<circle>` or `<ellipse>`, absolute or relative M/L/H/V/C/Z) or `nsd` (a NOVAstitch project).
- `cornerRadius: true`: the shape takes rounded corners (rectangles).
- `license`: an SPDX identifier (the shapes made for NOVAstitch are CC0-1.0).
