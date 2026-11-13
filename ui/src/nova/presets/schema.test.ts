// Module e: the public schema of the preset files (fabric-preset.schema.json,
// JSON Schema 2020-12) says what the program accepts: every shipped preset
// validates, and the schema and the program refuse the same mistakes.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { PARAMS, parsePreset } from "./preset";

const here = path.resolve(process.cwd(), "src/nova/presets");
const schema = JSON.parse(readFileSync(path.join(here, "fabric-preset.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "the preset schema is JSON Schema 2020-12");

// the stitch parameters in the schema are the program's
for (const type of ["satin", "fill", "running"] as const)
  check(
    Object.keys(schema.properties[type].properties).sort().join() === Object.keys(PARAMS[type]).sort().join() &&
      Object.entries(PARAMS[type]).every(([k, kind]) => schema.properties[type].properties[k].type === kind),
    `the schema's ${type} parameters are the ones the program accepts`,
  );

const good = {
  schemaVersion: 1,
  id: "prova",
  rev: 1,
  name: { it: "Prova", en: "Test" },
  base: "cotton",
  elastic: false,
  overlap: { flat: 0.2, cap: 0.4 },
  satin: { spacing: 0.4, contourInset: 0.5 },
  fill: { underlay: true, underlayAngle: 90 },
  running: { length: 2.5 },
  satinContourFrom: 2,
  limits: { minSpacing: 0.3 },
  info: { it: "Scheda", en: "Sheet" },
  stabilizer: { type: "cut-away", weight: 80 },
  topping: "water-soluble-film",
  needlePoint: "ballpoint",
};
const accepted = (o: unknown) => {
  try {
    parsePreset("prova.json", o);
    return true;
  } catch {
    return false;
  }
};
check(validate(good) && accepted(good), "a complete preset: valid for the schema and for the program");
const without = (k: string) => Object.fromEntries(Object.entries(good).filter(([x]) => x !== k));
const cases: [string, unknown][] = [
  ["no English name", { ...good, name: { it: "Prova" } }],
  ["empty Italian name", { ...good, name: { it: " ", en: "Test" } }],
  ["unknown fabric", { ...good, base: "wool" }],
  ["misspelt satin parameter", { ...good, satin: { spacin: 0.4 } }],
  ["parameter of the wrong type", { ...good, fill: { underlay: "yes" } }],
  ["negative overlap", { ...good, overlap: { flat: -0.2, cap: 0.4 } }],
  ["no stabiliser weight", { ...good, stabilizer: { type: "cut-away" } }],
  ["unknown topping", { ...good, topping: "foam" }],
  ["unknown needle point", { ...good, needlePoint: "wedge" }],
  ["unknown field", { ...good, colour: "red" }],
  ["no limits", without("limits")],
  ["id with capitals", { ...good, id: "Prova" }],
];
for (const [what, o] of cases) check(!validate(o) && !accepted(o), `refused by both: ${what}`);

// every shipped preset validates
const dir = path.join(here, "fabric");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const o = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  check(validate(o), `${f} validates against the schema (${ajv.errorsText(validate.errors)})`);
}

done("preset schema");
