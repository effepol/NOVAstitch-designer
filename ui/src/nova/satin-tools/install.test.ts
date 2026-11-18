// Module m in the app: the commands are registered and removed, every text has
// both languages, nothing of Filum is touched (the tools come with the registry).

import { check, done } from "../core/testkit";
import { getCommand } from "../core/commands";
import { setLanguage, t } from "../core/i18n";
import { installSatinTools } from "./install";
import { SATIN_TOOL_COMMANDS } from "./commands";
import it from "./it.json";
import en from "./en.json";

const off = installSatinTools();
for (const c of SATIN_TOOL_COMMANDS) check(!!getCommand(c.id) && c.id.startsWith("m."), `${c.id} is registered`);
const keys = (o: Record<string, string>) => Object.keys(o).sort().join();
check(keys(it) === keys(en) && Object.keys(it).every((k) => k.startsWith("m.")), "it.json and en.json have the same m.* keys");
setLanguage("it");
check(t("m.twoRails.oddDropped").startsWith("Numero di click dispari"), "Italian text from the catalog");
setLanguage("en");
off();
check(SATIN_TOOL_COMMANDS.every((c) => !getCommand(c.id)), "uninstalling removes the commands");
done("module m in the app");
