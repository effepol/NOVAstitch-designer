// Contract «b, parte 2» (18/11), the core's part: the object's link (join / jump) and
// the connections the plan hands to the interface. The engine's tests are in
// crates/core/src/assemble.rs (link_tests); here: the way to the interface.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DesignObject, PlanData, PlanLink } from "../../types";

const root = path.resolve(process.cwd(), "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

// the types: an object may carry link, a plan its connections
const o = { link: "join" } as Pick<DesignObject, "link">;
const l: PlanLink = { from: 0, to: 1, kind: "sew", manual: true, visible: false, start: [30, 0], end: [40, 0] };
const plan = { links: [l] } as Pick<PlanData, "links">;
check(o.link === "join" && plan.links?.[0].kind === "sew", "types.ts: DesignObject.link and PlanData.links (kind, manual, visible, start, end)");

// the engine's plan reaches the interface with its connections
check(/"links": plan\.links/.test(read("crates/wasm/src/lib.rs")), "wasm: the plan's meta carries links");
check(/links: meta\.links \?\? \[\]/.test(read("ui/src/engine/worker.ts")), "worker.ts: PlanData.links comes from the engine");

// the public schema knows the field
const schema = JSON.parse(read("schema/filum-core.schema.json"));
const defs = schema.$defs ?? schema.definitions ?? {};
check(JSON.stringify(defs.ObjectLink ?? {}).includes('"join"') && JSON.stringify(defs.ObjectLink ?? {}).includes('"jump"'), "schema: link is join or jump");

done("object link (b, parte 2)");
