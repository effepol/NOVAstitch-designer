// Contract test a.7 (module a, writing in two steps): a temporary file in the
// same folder, then renamed over the old one. Whatever fails, and wherever,
// the original keeps its bytes and no temporary file is left behind.
// Also a.2's half that belongs here: a .filum is never written.

import { check, done } from "../core/testkit";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NotNsdError, writeAtomic, type FileOps } from "./atomic";

const disk: FileOps = {
  write: async (p, bytes) => writeFileSync(p, bytes),
  read: async (p) => readFileSync(p),
  rename: async (from, to) => renameSync(from, to),
  remove: async (p) => rmSync(p, { force: true }),
  list: async (dir) => readdirSync(dir),
};

const enc = new TextEncoder();
const original = enc.encode(`${JSON.stringify({ version: 1, objects: [], nova: { schemaVersion: 1 }, name: "Originale àè" }, null, 2)}\n`);
const next = enc.encode(`${JSON.stringify({ version: 1, objects: [], nova: { schemaVersion: 1 }, name: "Nuovo" }, null, 2)}\n`);
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A fresh folder holding Stemma.nsd with the original bytes, and a neighbour that must never be touched. */
function folder() {
  const dir = mkdtempSync(path.join(tmpdir(), "nova-a7-"));
  writeFileSync(path.join(dir, "Stemma.nsd"), original);
  writeFileSync(path.join(dir, "Altro.nsd"), next);
  return { dir, file: path.join(dir, "Stemma.nsd") };
}
const listing = (dir: string) => readdirSync(dir).sort().join(", ");
const intact = (dir: string, file: string, what: string) => {
  check(equal(readFileSync(file), original), `a.7 ${what}: the original has the same bytes as before`);
  check(listing(dir) === "Altro.nsd, Stemma.nsd", `a.7 ${what}: no temporary file left (${listing(dir)})`);
  check(equal(readFileSync(path.join(dir, "Altro.nsd")), next), `a.7 ${what}: the other files of the folder are untouched`);
};
const fails = async (fn: () => Promise<void>) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e as Error;
  }
};

(async () => {
  // a plain save: the new bytes, nothing else in the folder
  {
    const { dir, file } = folder();
    let tmpSeen = "";
    await writeAtomic({ ...disk, write: async (p, b) => ((tmpSeen = p), disk.write(p, b)) }, file, next);
    check(equal(readFileSync(file), next), "a save writes the new bytes");
    check(listing(dir) === "Altro.nsd, Stemma.nsd", `…and leaves nothing else (${listing(dir)})`);
    check(path.relative(dir, tmpSeen) === path.basename(tmpSeen) && tmpSeen !== file, `the temporary file is in the same folder (${path.basename(tmpSeen)})`);
  }

  // a new file in an empty spot
  {
    const { dir } = folder();
    await writeAtomic(disk, path.join(dir, "Nuovo.nsd"), next);
    check(equal(readFileSync(path.join(dir, "Nuovo.nsd")), next) && listing(dir) === "Altro.nsd, Nuovo.nsd, Stemma.nsd", "a new .nsd is written, nothing else");
  }

  // ---- a.7: the simulated error right after the temporary file is written (the rename fails)
  {
    const { dir, file } = folder();
    const err = await fails(() => writeAtomic({ ...disk, rename: async () => { throw new Error("simulated: disk removed"); } }, file, next));
    check(err?.message === "simulated: disk removed", `a.7 the error reaches the caller (${err?.message})`);
    intact(dir, file, "rename fails");
  }

  // the temporary file is written only in part, then the write fails
  {
    const { dir, file } = folder();
    const err = await fails(() =>
      writeAtomic({ ...disk, write: async (p, b) => { writeFileSync(p, b.slice(0, 10)); throw new Error("simulated: disk full"); } }, file, next),
    );
    check(!!err, "a.7 a write that fails half-way is an error");
    intact(dir, file, "write fails half-way");
  }

  // the write says it worked but the bytes on disk are not the ones sent (checked before the rename)
  {
    const { dir, file } = folder();
    const err = await fails(() => writeAtomic({ ...disk, write: async (p, b) => writeFileSync(p, b.slice(0, b.length - 3)) }, file, next));
    check(!!err, `a.7 a short write is caught before the rename (${err?.message})`);
    intact(dir, file, "short write");
  }

  // the program dies between the write and the rename: the temporary file stays, the original is safe;
  // the next save of that file cleans it up
  {
    const { dir, file } = folder();
    const err = await fails(() =>
      writeAtomic({ ...disk, rename: async () => { throw new Error("simulated: killed"); }, remove: async () => { throw new Error("simulated: killed"); } }, file, next),
    );
    check(!!err && equal(readFileSync(file), original), "a.7 killed before the rename: the original has the same bytes");
    const left = readdirSync(dir).filter((f) => f !== "Stemma.nsd" && f !== "Altro.nsd");
    check(left.length === 1, `(the leftover a crash leaves: ${left.join(", ")})`);
    await writeAtomic(disk, file, next);
    check(equal(readFileSync(file), next) && listing(dir) === "Altro.nsd, Stemma.nsd", `a.7 the next save cleans the leftover up (${listing(dir)})`);
  }

  // ---- a.2 (the part of writing): a .filum, or anything that is not .nsd, is never written
  for (const name of ["Stemma.filum", "Stemma.FILUM", "Stemma.json", "Stemma", "Stemma.nsd.filum"]) {
    const dir = mkdtempSync(path.join(tmpdir(), "nova-a2-"));
    const target = path.join(dir, name);
    writeFileSync(target, original);
    let wrote = false;
    const err = await fails(() => writeAtomic({ ...disk, write: async (p, b) => ((wrote = true), disk.write(p, b)) }, target, next));
    check(err instanceof NotNsdError && !wrote, `a.2 writing ${name} is refused before anything is written`);
    check(equal(readFileSync(target), original) && readdirSync(dir).length === 1, `a.2 ${name} has the same bytes as before`);
  }

  done("module a, safe writing");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
