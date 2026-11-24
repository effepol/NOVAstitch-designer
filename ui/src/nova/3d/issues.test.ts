// Contract tests j.5 and j.7 (module j): the warnings «il 3D va cucito per
// ultimo» (a satin over foam that is not last) and «3D a strati sotto i 6 mm»,
// in Filum's Issues list through module 0's registry.

import { check, done } from "../core/testkit";
import { useStore } from "../../store";
import { computeIssues } from "../../lib/issues";
import { defaultSatin, rectPath } from "../../lib/geometry";
import { setLanguage, t } from "../core/i18n";
import type { DesignObject, StitchDocument } from "../../types";
import { installStitch3d } from "./install";
import { defaultFoam } from "./foam";
import { toLayered3d } from "./layered3d";
import { layeredWidth } from "./issues";

const line = (y: number): DesignObject["paths"] => [{ closed: false, nodes: [{ p: [0, y] }, { p: [40, y] }] }];
const obj = (id: string, stitch: DesignObject["stitch"], paths = line(0), visible = true): DesignObject => ({ id, name: id, thread: "t1", visible, locked: false, trimAfter: false, stopAfter: false, paths, stitch });
const satin = { type: "satin" as const, ...defaultSatin(), width: 5 };
const foam = (id: string) => obj(id, { ...satin, foam: defaultFoam() }, line(10));
const fill = (id: string) => obj(id, { type: "fill" } as never, [rectPath(0, 20, 20, 20)]);
const layered = (id: string, width: number) => obj(id, toLayered3d(obj(id, { ...satin, width })), line(30));
const docOf = (objects: DesignObject[]): StitchDocument => ({ ...useStore.getState().doc, objects });
const ids = (doc: StitchDocument, kind: string) => computeIssues(doc, null).filter((i) => i.id.startsWith(`j.${kind}:`)).map((i) => i.objId);

setLanguage("it");
const off = installStitch3d();

// j.5
check(ids(docOf([fill("a"), foam("f")]), "foamLast").length === 0, "schiuma per ultima: nessun avviso");
check(ids(docOf([fill("a"), foam("f"), foam("g")]), "foamLast").length === 0, "più oggetti schiuma in fondo: nessun avviso");
const notLast = computeIssues(docOf([foam("f"), fill("a")]), null).find((i) => i.id === "j.foamLast:f");
check(!!notLast && notLast.title === "Il 3D va cucito per ultimo" && notLast.level === "warning", "j.5 schiuma non ultima: avviso «il 3D va cucito per ultimo»");
check(!notLast?.fix, "solo un avviso: la sequenza non cambia da sola");
check(ids(docOf([foam("f"), { ...fill("a"), visible: false }]), "foamLast").length === 0, "dopo c'è solo un oggetto nascosto (non si cuce): nessun avviso");
check(ids(docOf([obj("s", satin), fill("a")]), "foamLast").length === 0, "un satin normale non è schiuma");

// j.7
check(layeredWidth(layered("l", 5)) === 5, "larghezza della colonna (linea centrale)");
const thin = computeIssues(docOf([layered("l", 5)]), null).find((i) => i.id === "j.layeredThin:l");
check(!!thin && thin.title === "3D a strati sotto i 6 mm" && thin.detail.includes("5 mm"), "j.7 forma 5 mm in 3D a strati: avviso sotto i 6 mm");
check(ids(docOf([layered("l", 6)]), "layeredThin").length === 0 && ids(docOf([layered("l", 12)]), "layeredThin").length === 0, "da 6 mm in su: nessun avviso");
// two rails 4 mm apart
const rails = obj("r", toLayered3d(obj("r", satin)), [...line(0), ...line(4)]);
check(Math.abs((layeredWidth(rails) ?? 0) - 4) < 0.01 && ids(docOf([rails]), "layeredThin").length === 1, "con due binari: la loro distanza (4 mm → avviso)");

// texts in both languages
setLanguage("en");
check(computeIssues(docOf([foam("f"), fill("a")]), null).some((i) => i.title === t("j.issue.foamLast.title") && i.title === "3D goes last"), "in inglese");
off();
check(ids(docOf([foam("f"), fill("a")]), "foamLast").length === 0, "install() si può togliere");

done("j avvisi");
