// Test L (approved 12/11): choice of language, default the system's.

import { check, done } from "./testkit";
import { initLanguage, getLanguage, setLanguage, addCatalog, t } from "./i18n";

addCatalog({ "test.hello": "Ciao" }, { "test.hello": "Hello" });

check(initLanguage({ system: ["it-IT"] }) === "it", "L system it-IT, first start → Italian");
check(initLanguage({ system: ["en-US"] }) === "en", "L system en-US → English");
check(initLanguage({ system: ["de-DE"] }) === "en", "L system de-DE → English (fallback)");
check(initLanguage({ system: ["de-DE", "it"] }) === "it", "L the first supported language in the system's list wins");
check(initLanguage({ system: ["en-US"], saved: "it" }) === "it", "L a saved choice wins over the system's language");

initLanguage({ system: ["en-US"] });
check(t("test.hello") === "Hello", "L t() in English");
setLanguage("it");
check(getLanguage() === "it" && t("test.hello") === "Ciao", "L changing language updates t() without a restart");

done("language");
