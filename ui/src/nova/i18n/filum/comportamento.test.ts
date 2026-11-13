// Modulo i — la traduzione non cambia il comportamento (contratto: «cambia solo testi»).
// Dove Filum confronta o salva etichette, l'italiano deve dare gli stessi risultati dell'inglese.

import "../../core/testkit";
import { check, done } from "../../core/testkit";
import { setLanguage } from "../../core/i18n";
import { inEnglish, t } from "./index";
import { contextMenu, flattenMenus, buildMenus } from "../../../components/menuModel";
import { useStore } from "../../../store";
import { sampleDocument } from "../../../sample";

const labels = (items: ReturnType<typeof contextMenu>) => items.map((i) => (i === "-" ? "-" : i.label));

setLanguage("en");
useStore.setState({ doc: sampleDocument() });
const first = useStore.getState().doc.objects[0].id;

for (const onObject of [true, false]) {
  if (onObject) useStore.getState().select([first]);
  else useStore.getState().select([]);
  setLanguage("en");
  const en = labels(contextMenu(onObject));
  setLanguage("it");
  const it = labels(contextMenu(onObject));
  check(en.length > 3 && it.length === en.length, `i il menu del tasto destro ${onObject ? "su un oggetto" : "sul vuoto"} ha le stesse voci in italiano (${it.length}) e in inglese (${en.length})`);
  check(it.every((l, i) => l === "-" || inEnglish(l).includes(en[i])), `i ogni voce italiana del menu del tasto destro ${onObject ? "su un oggetto" : "sul vuoto"} torna alla sua voce inglese`);
}

setLanguage("en");
const commandsEn = flattenMenus(buildMenus()).length;
setLanguage("it");
const commandsIt = flattenMenus(buildMenus()).length;
check(commandsEn > 100 && commandsIt === commandsEn, `i i comandi della ricerca sono gli stessi nelle due lingue (${commandsIt} e ${commandsEn})`);

setLanguage("it");
check(inEnglish(t("filum.menu.cut")).includes("Cut"), "i inEnglish: «Taglia» → «Cut» (ricerca in inglese e comandi recenti)");
check(inEnglish("Un testo qualsiasi")[0] === "Un testo qualsiasi", "i inEnglish lascia com'è un testo fuori dai cataloghi");
setLanguage("en");
check(inEnglish("Cut")[0] === "Cut", "i in inglese inEnglish restituisce il testo stesso");

done("traduzione di Filum: comportamento");
