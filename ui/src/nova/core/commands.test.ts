// Contract test 0.1: a command run with runCommand is one undo step, and one undo
// brings the document back exactly as it was.

import { check, done } from "./testkit";
import { useStore } from "../../store";
import { registerCommand, runCommand } from "./commands";
import type { StitchDocument } from "../../types";

registerCommand<{ name: string }>({
  id: "test.rename",
  label: { it: "Rinomina", en: "Rename" },
  apply: (doc, p): StitchDocument => ({ ...doc, name: p.name }),
});

const before = useStore.getState().doc;
const snapshot = JSON.stringify(before);
const pastBefore = useStore.getState().past.length;

runCommand("test.rename", { name: "Stemma" });
check(useStore.getState().doc.name === "Stemma", "0.1 the command changed the document");
check(useStore.getState().past.length === pastBefore + 1, `0.1 past grows by 1 (${pastBefore} → ${useStore.getState().past.length})`);

useStore.getState().undo();
check(useStore.getState().doc === before && JSON.stringify(useStore.getState().doc) === snapshot, "0.1 one undo gives back the document identical to before");

let threw = false;
try {
  runCommand("test.missing", {});
} catch {
  threw = true;
}
check(threw && useStore.getState().past.length === pastBefore, "0.1 an unknown command is refused and leaves no undo step");

// a command that changes nothing leaves no undo step (e.g. f.9, align with one object)
registerCommand({ id: "test.nothing", label: { it: "Niente", en: "Nothing" }, apply: (doc) => doc });
const n = useStore.getState().past.length;
runCommand("test.nothing", {});
check(useStore.getState().past.length === n, "0.1 a command that changes nothing leaves no undo step");

// ids are "<module>.<name>" and registered once
let dup = "";
try {
  registerCommand({ id: "test.rename", label: { it: "x", en: "x" }, apply: (d) => d });
} catch (e) {
  dup = (e as Error).message;
}
check(dup.includes("test.rename"), `0.1 a second command with the same id is refused ("${dup}")`);
let bad = false;
try {
  registerCommand({ id: "nomodule", label: { it: "x", en: "x" }, apply: (d) => d });
} catch {
  bad = true;
}
check(bad, "0.1 an id without a module prefix is refused");

done("command");
