// Help › Licences (module 0, request of 24/11): the list is generated again
// (npm run licenses) so it has pdf-lib (MIT, module l's work sheet), and
// NOTICE counts the same packages and crates as the list.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const list = JSON.parse(readFileSync(path.join(root, "ui/public/licenses/third-party.json"), "utf8")) as { npm: { name: string; license: string }[]; cargo: { name: string }[] };
const pdf = list.npm.find((p) => p.name === "pdf-lib");
check(!!pdf && pdf.license === "MIT", "pdf-lib is in Help › Licences, MIT");
const deps = Object.keys(JSON.parse(readFileSync(path.join(root, "ui/package.json"), "utf8")).dependencies ?? {});
check(deps.every((d) => d.startsWith("@types/") || list.npm.some((p) => p.name === d)), "every dependency of the interface is in the list");
const notice = readFileSync(path.join(root, "NOTICE"), "utf8");
check(notice.includes(`${list.npm.length} pacchetti npm e ${list.cargo.length} crate Rust`) && notice.includes(`${list.npm.length} npm packages and ${list.cargo.length} Rust crates`), `NOTICE counts the list: ${list.npm.length} npm packages, ${list.cargo.length} crates`);

done("elenco delle licenze");
