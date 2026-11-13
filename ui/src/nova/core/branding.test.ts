// Branding (module 0, 13/11): NOVAstitch Designer's name, README, NOTICE, logo and
// About window. Every copyright and licence already in the repository is kept in NOTICE.

import { check, done } from "./testkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ui = process.cwd();
const root = path.resolve(ui, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const NAME = "NOVAstitch Designer";

// README and NOTICE
const readme = read("README.md");
check(readme.startsWith(`# ${NAME}`) && readme.includes("**Stato / Status.**") && readme.includes("Vedi `LICENSE`. Basato su Filum: vedi `NOTICE`."), "README is NOVAstitch Designer's");
check(existsSync(path.join(root, "NOTICE")), "there is a NOTICE file");
const notice = existsSync(path.join(root, "NOTICE")) ? read("NOTICE") : "";
check(notice.includes("Copyright (c) 2026 Poletti Centro Cucito") && notice.includes("versione modificata di Filum") && notice.includes("modified version of Filum"), "NOTICE says who modified Filum, in Italian and English");
check((notice.match(/https:\/\/github\.com\/benkl\/filum/g) ?? []).length >= 2, "NOTICE links Filum's repository");
// …and keeps every copyright and licence the repository already had
for (const kept of [
  "Benjamin Kleinert", // Filum (Cargo.toml authors)
  "Ink/Stitch authors", // ported algorithms, thread charts
  "Copyright (c) 2018 Tatarize", // pystitch, crates/formats
  "Chaoning Zhang", "Xavier Soria Poma", "Caroline Chan", "Tesseract", // bundled models
  "Copyright 2014 The Nunito Project Authors", "Copyright © 2010 by Dharma Type", "Copyright 2018 The Pacifico Project Authors", // interface fonts
  "ui/public/embroidery-fonts", "infinipicto", "precious", "nick_ainley", "Seniors Studio", // embroidery fonts
  "Madeira", "Embroidery Nerds", "CC BY-NC-SA 4.0", "Hoshyari", "VTracer", // colours, optional downloads, research
  "ui/public/licenses/third-party.json",
])
  check(notice.includes(kept), `NOTICE keeps: ${kept}`);
check(read("LICENSE").includes("GNU GENERAL PUBLIC LICENSE") && read("LICENSE").includes("Version 3, 29 June 2007"), "LICENSE is still the GPL-3.0 text");

// name of the window and of the packages
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
check(tauri.productName === NAME && tauri.app.windows[0].title === NAME, "the app and its window are called NOVAstitch Designer");
// 0.14: an identifier of its own (it decides the data folder), the company's domain (13/11)
const ID = "it.poletticentrocucito.novastitch-designer";
check(tauri.identifier === ID, `0.14 the identifier is ${ID} (got ${tauri.identifier})`);
const assoc = tauri.bundle.fileAssociations as { ext: string[]; exportedType?: { identifier: string } }[];
const nsd = assoc.find((a) => a.ext.includes("nsd"));
check(nsd?.exportedType?.identifier === `${ID}.nsd`, "0.14 the .nsd type is the app's own");
check(!assoc.some((a) => a.ext.includes("filum")), "the app is not associated with .filum files any more (it still opens them from Open)");
// 0.11: Filum is not named in tauri.conf.json
check(!read("src-tauri/tauri.conf.json").includes("Filum"), "0.11 tauri.conf.json does not name Filum");
check(read("ui/index.html").includes(`<title>${NAME}</title>`), "the page title too");
check(read("ui/src/components/MenuBar.tsx").includes(`— ${NAME}\``), "the window title follows the design: “Design — NOVAstitch Designer”");
check(JSON.parse(read("package.json")).name === "novastitch-designer" && JSON.parse(read("ui/package.json")).name === "novastitch-designer-ui", "the packages are named novastitch-designer");
const lock = (p: string) => JSON.parse(read(p));
check(lock("package-lock.json").name === "novastitch-designer" && lock("ui/package-lock.json").name === "novastitch-designer-ui", "…in the lock files as well");

// the logo: the attached icon, as it is
const icon = path.join(root, "ui/public/icon.png");
check(existsSync(icon) && readFileSync(icon, "utf8").length > 0, "the interface has the provisional icon (ui/public/icon.png)");
check(read("ui/src/components/MenuBar.tsx").includes(`src="/icon.png"`), "the title bar shows it");
check(existsSync(path.join(root, "src-tauri/icons/icon.png")) && !existsSync(path.join(root, "src-tauri/icons/android")) && !existsSync(path.join(root, "src-tauri/icons/ios")), "the app icons are desktop only");

// About window: texts in Italian and English
const it = JSON.parse(read("ui/src/nova/core/it.json"));
const en = JSON.parse(read("ui/src/nova/core/en.json"));
check(it["core.about.line"] === "NOVAstitch Designer, versione {version}." && en["core.about.line"] === "NOVAstitch Designer, version {version}.", "About: name and version");
check(it["core.about.what"] === "Programma gratuito di digitalizzazione vettoriale per il ricamo." && en["core.about.what"] === "Free vector embroidery digitizing software.", "About: what it is");
// 0.12: based on Filum, a modified version, and the date (13/11)
check(
  it["core.about.base"] === "Basato su Filum (benkl), versione modificata nel 2026, GPL-3.0" && en["core.about.base"] === "Based on Filum (benkl), modified version, 2026, GPL-3.0",
  "0.12 About: based on Filum, modified version, 2026",
);
check(it["core.about.who"] === "Poletti Centro Cucito, Clusone" && en["core.about.who"] === "Poletti Centro Cucito, Clusone", "About: who");
check(
  ["license", "credits", "close"].every((b) => it[`core.about.${b}`] && en[`core.about.${b}`]) && it["core.about.license"] === "Licenza" && it["core.about.credits"] === "Crediti" && it["core.about.close"] === "Chiudi",
  "About: buttons Licenza, Crediti, Chiudi",
);
const dialogs = read("ui/src/components/Dialogs.tsx");
check(dialogs.includes("nova/core/about"), "Help → About opens NOVAstitch Designer's window");

done("branding");
