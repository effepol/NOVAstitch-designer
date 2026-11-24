// The NOVAstitch brand in the installers (module 0, Architect's decision of
// 24/11): version 0.1.0 wherever it is written (tauri.conf.json, src-tauri's
// Cargo.toml, package.json, and nova.app.version in the .nsd files); the
// installed program and the Linux package are «novastitch-designer»; the
// description, the publisher and the site are NOVAstitch's. Internal names that
// nobody sees (filum_core, filum.* keys) stay.

import { check, done } from "./testkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { APP } from "../format/nova";

const root = path.resolve(process.cwd(), "..");
const read = (f: string) => (existsSync(path.join(root, f)) ? readFileSync(path.join(root, f), "utf8") : "");
const VERSION = "0.1.0";
const NAME = "novastitch-designer";
const DESCRIPTION = "NOVAstitch Designer — vector embroidery digitizing. Based on Filum.";
const PUBLISHER = "Poletti Centro Cucito";
const SITE = "https://github.com/effepol/NOVAstitch-designer";

// the package configuration files: none of Filum's names or version
const files = ["src-tauri/tauri.conf.json", "src-tauri/tauri.linux.conf.json", "src-tauri/Cargo.toml", "package.json", "ui/package.json", "src-tauri/linux/novastitch-designer.desktop"];
for (const f of files) {
  const text = read(f);
  check(text !== "", `${f} is there`);
  check(!/filum-desktop|nov-astitch|0\.2\.1/.test(text), `${f}: no «filum-desktop», «nov-astitch» or «0.2.1»`);
}

const conf = JSON.parse(read("src-tauri/tauri.conf.json") || "{}");
const cargo = read("src-tauri/Cargo.toml");
check(conf.version === VERSION, "tauri.conf.json: version 0.1.0");
check(new RegExp(`^version = "${VERSION}"`, "m").test(cargo), "src-tauri/Cargo.toml: version 0.1.0");
check(JSON.parse(read("package.json") || "{}").version === VERSION && JSON.parse(read("ui/package.json") || "{}").version === VERSION, "package.json and ui/package.json: version 0.1.0");
check(APP.version === VERSION && APP.version === conf.version, "nova.app.version in the .nsd files: 0.1.0, the same as the installers");

check(new RegExp(`^name = "${NAME}"`, "m").test(cargo) && conf.mainBinaryName === NAME, "the installed program is «novastitch-designer»");
check(/^\[lib\]\nname = "filum_desktop_lib"/m.test(cargo), "(the internal library name stays)");
check(conf.productName === "NOVAstitch Designer", "the program's name everywhere it is shown: NOVAstitch Designer");
const linux = JSON.parse(read("src-tauri/tauri.linux.conf.json") || "{}");
// Tauri names the Debian package after the product name in kebab case: «NOVAstitch» would give «nov-astitch»
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
check(kebab("NOVAstitch Designer") === "nov-astitch-designer", "(the kebab case above gives Tauri's «nov-astitch-designer» for the shared name)");
check(kebab(linux.productName ?? conf.productName) === NAME, "Linux: the package name is «novastitch-designer»");
const desktop = read("src-tauri/linux/novastitch-designer.desktop");
check(linux.bundle?.linux?.deb?.desktopTemplate === "linux/novastitch-designer.desktop" && /^Name=NOVAstitch Designer$/m.test(desktop), "Linux: the applications menu still shows «NOVAstitch Designer»");

const b = conf.bundle ?? {};
check(b.shortDescription === DESCRIPTION && b.longDescription === DESCRIPTION, `description: «${DESCRIPTION}»`);
check(b.publisher === PUBLISHER, `publisher: ${PUBLISHER}`);
check(b.homepage === SITE, "site: the repository's address");
check(new RegExp(`^description = "${DESCRIPTION}"`, "m").test(cargo) && cargo.includes(`authors = ["${PUBLISHER}"]`) && cargo.includes(`repository = "${SITE}"`), "src-tauri/Cargo.toml: the same description, publisher and site");
check(/--exclude novastitch-designer/.test(read("package.json")), "npm test leaves out the desktop shell by its new name");

done("marchio NOVAstitch nei pacchetti");
