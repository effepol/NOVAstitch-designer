// Contract test a.8 (module a): every test file of the repository validates
// against the public schema in schema/ (JSON Schema 2020-12): the part
// generated from the Rust types (filum-core.schema.json, crates/schema-gen)
// and the part written by hand for nova and the interface-only fields
// (nsd.schema.json). The schema is checked to refuse what it must refuse.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { readProject } from "./read";
import { nsdText } from "./serialize";
import type { StitchDocument } from "../../types";

const root = path.resolve(process.cwd(), "..");
const schemaDir = path.join(root, "schema");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const core = json(path.join(schemaDir, "filum-core.schema.json"));
const nsd = json(path.join(schemaDir, "nsd.schema.json"));

check(core.$schema === "https://json-schema.org/draft/2020-12/schema" && nsd.$schema === core.$schema, "a.8 both parts are JSON Schema 2020-12");

// the number formats schemars writes (Rust's types), checked for what they mean
const ajv = new Ajv2020({ allErrors: true, strict: true });
const integer = (min: number, max: number) => ({ type: "number" as const, validate: (n: number) => Number.isInteger(n) && n >= min && n <= max });
ajv.addFormat("double", { type: "number", validate: (n: number) => Number.isFinite(n) });
ajv.addFormat("float", { type: "number", validate: (n: number) => Number.isFinite(n) });
for (const [f, min, max] of [["uint", 0, Number.MAX_SAFE_INTEGER], ["uint8", 0, 255], ["uint16", 0, 65535], ["uint32", 0, 4294967295], ["uint64", 0, Number.MAX_SAFE_INTEGER], ["int32", -2147483648, 2147483647], ["int64", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], ["int", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]] as const)
  ajv.addFormat(f, integer(min, max));
ajv.addSchema(core);
const validate = ajv.compile(nsd);
const errors = () => ajv.errorsText(validate.errors, { separator: "; " }).slice(0, 400);

// ---- every test file of the repository: .nsd, .filum and the JSON examples in schema/examples
const skip = new Set(["node_modules", "target", ".git", "dist", "gen"]);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    if (skip.has(f)) return [];
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(root).filter((p) => /\.(nsd|filum)$/i.test(p) || (p.startsWith(path.join(schemaDir, "examples")) && p.endsWith(".json")));
check(files.length >= 3, `a.8 the repository has test files (${files.map((f) => path.relative(root, f)).join(", ")})`);
for (const f of files) {
  const ok = validate(json(f));
  check(!!ok, `a.8 ${path.relative(root, f)} validates${ok ? "" : `: ${errors()}`}`);
}

// what module a writes validates too: the Filum sample saved as .nsd
const filum = readFileSync(path.join(schemaDir, "examples", "Stemma.filum"), "utf8");
const written = JSON.parse(nsdText(readProject("Stemma.filum", new TextEncoder().encode(filum)).doc)) as StitchDocument;
check(!!validate(written), `a.8 a .nsd written by module a validates${validate(written) ? "" : `: ${errors()}`}`);

// ---- the schema refuses what it must: it is not a schema that accepts anything
const refuse: [string, (d: Record<string, any>) => void][] = [
  ["nova.schemaVersion as text", (d) => (d.nova.schemaVersion = "1")],
  ["nova.hoopKind other than flat/cap", (d) => (d.nova.hoopKind = "round")],
  ["nova.mode other than assisted/studio", (d) => (d.nova.mode = "expert")],
  ["nova.hoopRef without id", (d) => (d.nova.hoopRef = { name: "x" })],
  ["a patch group with an unknown order", (d) => (d.nova.patchGroups = [{ id: "g", sourceIds: [], rows: 1, cols: 1, gap: [0, 0], order: "zigzag", colorGrouping: "byColor", cells: [] }])],
  ["an object's nova.edited not a list of names", (d) => (d.objects[0].nova = { edited: "stitch.angle" })],
  ["objects not a list (Filum part)", (d) => (d.objects = {})],
  ["an object without paths (Filum part)", (d) => delete d.objects[0].paths],
  ["an unknown stitch type (Filum part)", (d) => (d.objects[0].stitch = { type: "laser" })],
  ["a hoop with a size as text (Filum part)", (d) => (d.hoop.width = "150")],
  ["a reference picture without src (interface-only part)", (d) => (d.references = [{ id: "r", name: "r", x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, placement: "behind" }])],
  ["an object's group not text (interface-only part)", (d) => (d.objects[0].group = 3)],
];
for (const [what, spoil] of refuse) {
  const d = JSON.parse(JSON.stringify(written));
  spoil(d);
  check(!validate(d), `a.8 the schema refuses ${what}`);
}

// unknown fields stay allowed (a.4): "foo" at the top, in nova, in an object
{
  const d = JSON.parse(JSON.stringify(written));
  d.foo = 1;
  d.nova.foo = 1;
  d.objects[0].foo = 1;
  check(!!validate(d), `a.8 unknown fields are allowed, as a.4 keeps them${validate(d) ? "" : `: ${errors()}`}`);
}

// a Filum design from before an older field rename (fill "clockwise") is still a valid file
{
  const d = JSON.parse(JSON.stringify(written));
  const fill = d.objects.find((o: { stitch: { type: string } }) => o.stitch.type === "fill");
  delete fill.stitch.contourClockwise;
  fill.stitch.clockwise = false;
  check(!!fill && !!validate(d), "a.8 a fill with the old «clockwise» key is valid (FillParams is read with remote = \"Self\")");
}

done("module a, schema");
