// The bottom bar (module 0, from the trials of build 1, Signor Poletti 25/11):
// «Animate» could not be seen. Every button of the bar stays reachable: when
// there is no room, the least used go into a «More» menu, never off screen.
// «Animate» never goes into the menu.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hiddenForWidth, overflowOrder } from "./barOverflow";
import it from "./it.json";
import en from "./en.json";

// the order they go into the menu: Video, the modules' buttons (the last first), the zooms (6×, 0.5×, 4×, 2×, 1×)
const order = overflowOrder(["0.5", "1", "2", "4", "6"].map((z) => `zoom:${z}`), ["b.links", "c.target", "c.cross", "d.needle"]);
check(order.join() === "video,d.needle,c.cross,c.target,b.links,zoom:6,zoom:0.5,zoom:4,zoom:2,zoom:1", `the order: ${order.join(", ")}`);
check(!order.includes("animate"), "«Animate» is never in the menu");

const widths = new Map(order.map((k) => [k, k.startsWith("zoom") ? 32 : 90]));
// room for everything: no menu
check(hiddenForWidth(order, widths, 600, 1300, 36).length === 0, "room for everything (600 + 610 px in 1300): nothing in the menu");
// 100 px short: Video and one module button go (the «More» button takes 36 px too)
const short = hiddenForWidth(order, widths, 600, 1100, 36);
check(short.join() === "video,d.needle", `100 px short: ${short.join(", ")} in the menu`);
// very narrow: everything that can go, goes; nothing is left off screen
const all = hiddenForWidth(order, widths, 600, 500, 36);
check(all.length === order.length, "too narrow even then: every button that can go is in the menu");
// exactly enough: nothing hidden
check(hiddenForWidth(order, widths, 600, 600 + [...widths.values()].reduce((a, b) => a + b, 0), 36).length === 0, "exactly enough: no menu");

check(typeof it["core.bar.more"] === "string" && typeof en["core.bar.more"] === "string", "the «More» button's text from module 0's catalogue (it, en)");

const bar = readFileSync(path.join(process.cwd(), "src", "components", "BottomBar.tsx"), "utf8");
check(/hiddenForWidth\(/.test(bar) && /ResizeObserver/.test(bar), "the bar measures itself and puts the extra buttons into the menu");
check(/data-nova="core"[^>]*\n?[^>]*bb-overflow|bb-overflow[^>]*data-nova="core"/.test(bar), "the «More» button is module 0's (data-nova)");
const css = readFileSync(path.join(process.cwd(), "src", "styles.css"), "utf8");
check(!/@container \(max-width: 860px\) \{\s*\.bb-zoom \{\s*display: none;/.test(css), "the zoom buttons are not hidden by width any more: they go into the menu");

done("barra in basso: pulsanti sempre raggiungibili");
