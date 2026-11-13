// Contract tests a.2 and a.5 (module a, «Salva»): when Save writes in place and
// when it asks for a name, and which names it accepts.

import { check, done } from "../core/testkit";
import { chooseTarget, planSave } from "./savePlan";

// ---- a.2: a design opened from a .filum: Save asks where to save Stemma.nsd
{
  const p = planSave({ path: "/disegni/Stemma.filum", readOnly: false }, false, "Mountain badge");
  check(p.ask && p.suggestedName === "Stemma.nsd", `a.2 Save on a .filum asks, suggesting Stemma.nsd (${JSON.stringify(p)})`);
  check(p.ask && p.filters.length === 1 && p.filters[0].extensions.join() === "nsd", "a.2 the dialog offers only .nsd");
}
{
  const p = planSave({ path: "C:\\Disegni\\Stemma.json", readOnly: false }, false, "x");
  check(p.ask && p.suggestedName === "Stemma.nsd", `a .json is never written over either (${JSON.stringify(p)})`);
}

// a .nsd that can be written: Save writes in place, Save as asks
{
  const p = planSave({ path: "/disegni/Stemma.nsd", readOnly: false }, false, "x");
  check(!p.ask && p.path === "/disegni/Stemma.nsd", `Save on a .nsd writes in place (${JSON.stringify(p)})`);
  const q = planSave({ path: "/disegni/Stemma.nsd", readOnly: false }, true, "x");
  check(q.ask && q.suggestedName === "Stemma.nsd", "Save as on a .nsd asks");
}

// a design with no file yet: asks, named after the design
{
  const p = planSave({ path: null, readOnly: false }, false, "Mountain badge");
  check(p.ask && p.suggestedName === "Mountain badge.nsd", `a new design asks, suggesting its name (${JSON.stringify(p)})`);
  const q = planSave({ path: null, readOnly: false }, false, "  ");
  check(q.ask && q.suggestedName === "design.nsd", "…or «design» when it has none");
}

// ---- a.5: a .nsd from a newer version: Save asks for a new name, and the same file is refused
{
  const src = { path: "/disegni/Futuro.nsd", readOnly: true };
  const p = planSave(src, false, "x");
  check(p.ask && p.suggestedName !== "Futuro.nsd" && p.suggestedName.endsWith(".nsd"), `a.5 Save on a read-only design asks for a new name (${JSON.stringify(p)})`);
  const same = chooseTarget("/disegni/Futuro.nsd", src);
  check(!same.ok && same.reason === "readOnly", "a.5 the read-only file itself is refused as the target");
  const sameOtherCase = chooseTarget("/disegni/futuro.NSD", src);
  check(!sameOtherCase.ok, "a.5 …also written with other capitals (Windows and macOS do not tell them apart)");
  const other = chooseTarget("/disegni/Futuro copia.nsd", src);
  check(other.ok && other.path === "/disegni/Futuro copia.nsd", "a.5 another name is accepted");
}

// the name chosen in the dialog: a .nsd, never a .filum
{
  const src = { path: "/disegni/Stemma.filum", readOnly: false };
  const filum = chooseTarget("/disegni/Stemma.filum", src);
  check(!filum.ok && filum.reason === "filum", "a.2 a .filum chosen in the dialog is refused");
  const bare = chooseTarget("/disegni/Stemma", src);
  check(bare.ok && bare.path === "/disegni/Stemma.nsd", `a name without extension gets .nsd (${JSON.stringify(bare)})`);
  const json = chooseTarget("/disegni/Stemma.json", src);
  check(json.ok && json.path === "/disegni/Stemma.json.nsd", `any other extension gets .nsd added (${JSON.stringify(json)})`);
  const upper = chooseTarget("/disegni/Stemma.NSD", src);
  check(upper.ok && upper.path === "/disegni/Stemma.NSD", "a .NSD is a .nsd");
}

done("module a, Save");
