// Hook test (module 0): the modules start from main.tsx through startModules,
// which finds every ui/src/nova/<module>/install.ts (no Filum file lists them).

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = path.resolve(process.cwd(), "src");
const main = readFileSync(path.join(src, "main.tsx"), "utf8");
const modules = readFileSync(path.join(src, "nova", "core", "modules.ts"), "utf8");
check(/import \{ startModules \} from "\.\/nova\/core\/modules"/.test(main) && /\bstartModules\(\)/.test(main), "main.tsx starts the modules");
check(main.indexOf("startModules()") < main.indexOf("openLaunchFiles()"), "…before the file the app was opened with is read (its format must be registered)");
check(/import\.meta\.glob\(\s*"\.\.\/\*\/install\.ts"/.test(modules), "startModules finds every nova/<module>/install.ts");

done("module start hook");
