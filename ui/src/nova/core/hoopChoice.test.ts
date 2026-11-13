// Hook test (module 0, innesti for module a): every place where Filum changes
// the design's hoop goes through chooseHoop, so a module (a: a.hoop.select,
// a.hoop.custom) can write nova.hoopRef and nova.hoopKind. Without one, Filum's
// own change happens, as before. Hoop groups (the user's hoops) reach the pickers.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chooseHoop, hoopGroups, registerHoopChooser, registerHoopGroup, withHoop, type HoopChoice } from "./hoopChoice";
import { newDesign } from "../../lib/actions";
import { useStore } from "../../store";
import type { StitchDocument } from "../../types";

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

// the pure form, for a design not open yet (a new design): no undo step, the chooser's own result
{
  const base = { ...useStore.getState().doc, objects: [] } as StitchDocument;
  const flat = (d: StitchDocument) => ({ ...d, hoop: { name: "Filum", width: 1, height: 1 } });
  check(withHoop(base, { source: "preset", id: "x" }, flat).hoop.name === "Filum", "withHoop without a chooser: Filum's own hoop");
  const asked: HoopChoice[] = [];
  const offA = registerHoopChooser({
    module: "a",
    choose: () => true,
    apply: (d, c) => (asked.push(c), c.source === "preset" && c.id.endsWith("/pr-cap") ? { ...d, hoop: { name: "Cap", width: 130, height: 60 }, nova: { schemaVersion: 1, hoopKind: "cap" } } : null),
  });
  const past = useStore.getState().past.length;
  const done1 = withHoop(base, { source: "preset", id: "machine:brother-pr6/pr-cap" }, flat);
  check(done1.nova?.hoopKind === "cap" && done1.hoop.name === "Cap" && useStore.getState().past.length === past, "withHoop with a chooser: its result, no undo step, the open design untouched");
  check(withHoop(base, { source: "preset", id: "machine:x/other" }, flat).hoop.name === "Filum", "a chooser that declines (null): Filum's own hoop");

  // a.21 (module 0's half): a new design on a Brother PR with the cap frame goes through the chooser
  localStorage.setItem("filum.machine", "brother-pr6");
  localStorage.setItem("filum.frame", "pr-cap");
  asked.length = 0;
  const nd = newDesign();
  check(asked.length === 1 && asked[0].source === "preset" && (asked[0] as { id: string }).id === "machine:brother-pr6/pr-cap", `a new design's machine frame goes through the chooser (${JSON.stringify(asked)})`);
  check(nd.nova?.hoopKind === "cap" && nd.machine.profile === "brother-pr6", "a.21 the new design is a cap design from the first moment");
  offA();
  const plain = newDesign();
  check(plain.hoop.width === 130 && plain.hoop.height === 60 && plain.nova === undefined, "without a chooser, the new design gets Filum's hoop as before");
  localStorage.removeItem("filum.machine");
  localStorage.removeItem("filum.frame");
}

// hoop groups for the pickers
const offG = registerHoopGroup({ id: "a.user", module: "a", label: "a.hoops.mine", list: () => [{ id: "uh-1", name: "Mio 15×25", width: 150, height: 250 }] });
check(hoopGroups().length === 1 && hoopGroups()[0].list()[0].name === "Mio 15×25", "a module adds a group of hoops to the pickers");
offG();
check(hoopGroups().length === 0, "…and removes it");

// the new design (lib/actions.ts): its machine frame goes through withHoop
{
  const actions = readFileSync(path.join(path.resolve(process.cwd(), "src"), "lib/actions.ts"), "utf8");
  const nd = actions.slice(actions.indexOf("export function newDesign"), actions.indexOf("\n}\n", actions.indexOf("export function newDesign")));
  check(/withHoop\(/.test(nd) && !/\.\.\.\(f \? \{ hoop:/.test(nd), "newDesign sets the machine's frame through withHoop");
}

// every place in Filum that changes doc.hoop goes through chooseHoop
const src = path.resolve(process.cwd(), "src");
for (const f of ["components/Bars.tsx", "components/Dock.tsx", "components/MaterialPanel.tsx", "components/ExportDialog.tsx", "components/MachineSettings.tsx"]) {
  const lines = readFileSync(path.join(src, f), "utf8").split("\n");
  const sets = lines.filter((l) => /\.\.\.d,\s*hoop:/.test(l));
  const direct = sets.filter((l) => !l.includes("chooseHoop("));
  check(sets.length > 0 && direct.length === 0, `${f} changes the hoop only through chooseHoop (${sets.length} place(s); direct: ${direct.map((l) => l.trim()).join(" | ") || "none"})`);
}

done("hoop choice hook");
