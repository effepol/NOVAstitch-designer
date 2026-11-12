// Hook test (module 0, innesti for module a): every place where Filum changes
// the design's hoop goes through chooseHoop, so a module (a: a.hoop.select,
// a.hoop.custom) can write nova.hoopRef and nova.hoopKind. Without one, Filum's
// own change happens, as before. Hoop groups (the user's hoops) reach the pickers.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chooseHoop, hoopGroups, registerHoopChooser, registerHoopGroup, type HoopChoice } from "./hoopChoice";

const seen: HoopChoice[] = [];
let fallbacks = 0;

// no chooser: Filum's own change
chooseHoop({ source: "preset", id: "hoops:130 × 180 mm" }, () => fallbacks++);
check(fallbacks === 1, "without a chooser, Filum's own change runs");

const off = registerHoopChooser({ module: "a", choose: (c) => (seen.push(c), true) });
chooseHoop({ source: "custom", hoop: { name: "Custom", width: 120, height: 80 } }, () => fallbacks++);
check(fallbacks === 1 && seen.length === 1 && seen[0].source === "custom", "with a chooser, the choice goes to it and Filum's change does not run");
let dup = false;
try {
  registerHoopChooser({ module: "x", choose: () => true });
} catch {
  dup = true;
}
check(dup, "one hoop chooser at a time");
off();
chooseHoop({ source: "user", id: "uh-1" }, () => fallbacks++);
check(fallbacks === 2, "removed: Filum's own change again");

// a chooser that declines (unknown id): Filum's change runs
const off2 = registerHoopChooser({ module: "a", choose: () => false });
chooseHoop({ source: "preset", id: "?" }, () => fallbacks++);
check(fallbacks === 3, "a chooser that declines leaves the change to Filum");
off2();

// hoop groups for the pickers
const offG = registerHoopGroup({ id: "a.user", module: "a", label: "a.hoops.mine", list: () => [{ id: "uh-1", name: "Mio 15×25", width: 150, height: 250 }] });
check(hoopGroups().length === 1 && hoopGroups()[0].list()[0].name === "Mio 15×25", "a module adds a group of hoops to the pickers");
offG();
check(hoopGroups().length === 0, "…and removes it");

// every place in Filum that changes doc.hoop goes through chooseHoop
const src = path.resolve(process.cwd(), "src");
for (const f of ["components/Bars.tsx", "components/Dock.tsx", "components/MaterialPanel.tsx", "components/ExportDialog.tsx", "components/MachineSettings.tsx"]) {
  const lines = readFileSync(path.join(src, f), "utf8").split("\n");
  const sets = lines.filter((l) => /\.\.\.d,\s*hoop:/.test(l));
  const direct = sets.filter((l) => !l.includes("chooseHoop("));
  check(sets.length > 0 && direct.length === 0, `${f} changes the hoop only through chooseHoop (${sets.length} place(s); direct: ${direct.map((l) => l.trim()).join(" | ") || "none"})`);
}

done("hoop choice hook");
