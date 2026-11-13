// Module e's texts: t("e.<key>"), from it.json and en.json in this folder.

import { addCatalog } from "../core/i18n";
import it from "./it.json";
import en from "./en.json";

addCatalog(it, en);
