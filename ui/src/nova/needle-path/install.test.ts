// Module d hooked into the stitch view through module 0's registry (innesto c/d):
// off, Filum's stitch line as it is (d.4); on, the needle path in its place.

import { check, done } from "../core/testkit";
import { activeStitchLine, drawStitchLine, menuItems, toolbarButtons } from "../core/registry";
import { t } from "../core/i18n";
import { installNeedlePath } from "./install";
import { loadNeedlePathSettings, needlePathSettings, setNeedlePathSetting } from "./state";
import { planOf } from "./fixture";

(async () => {
  loadNeedlePathSettings({ get: () => undefined });
  const off = installNeedlePath();
  check(activeStitchLine() === undefined, "d.4 needle path off: Filum draws its own stitch line (no line takes its place)");
  const button = () => toolbarButtons().find((b) => b.id === "d.needlePath");
  check(!!button() && button()!.active?.() === false, "the bar has the «Needle path» button, off");
  const items = menuItems().filter((m) => m.module === "d");
  check(items.length === 5 && items.every((m) => m.menu === "View"), `the View menu has the needle path, its dots and three widths (${items.map((m) => m.id).join(", ")})`);
  check(items.filter((m) => m.id !== "d.needlePath").every((m) => m.disabled?.() === true), "with the needle path off its dots and widths are greyed");
  check([...items.map((m) => m.label), "d.bar.needlePath", "d.bar.needlePath.title"].every((k) => t(k) !== k), "every text has a catalog entry");

  button()!.run();
  await Promise.resolve();
  check(needlePathSettings().enabled && activeStitchLine()?.id === "d.needlePath", "the button turns it on: the needle path takes the place of Filum's line");
  check(button()!.active?.() === true, "the button shows it on");
  // the canvas calls drawStitchLine in the stitch view, with how far the stitch-out has gone
  const plan = planOf([
    [0, 0, 0],
    [10, 0, 0],
    [20, 0, 0],
  ]);
  const pts: number[] = [];
  const ctx = {
    save() {},
    restore() {},
    setLineDash() {},
    beginPath() {},
    stroke() {},
    fillRect() {},
    moveTo: (x: number) => void pts.push(x),
    lineTo: (x: number) => void pts.push(x),
  } as unknown as CanvasRenderingContext2D;
  drawStitchLine(ctx, { scale: 4, ox: 0, oy: 0, mode: "stitch" }, plan, 3);
  check(pts.join() === "0,10,20", `drawn through the registry from the plan (${pts.join()})`);
  pts.length = 0;
  drawStitchLine(ctx, { scale: 4, ox: 0, oy: 0, mode: "stitch" }, plan, 2);
  check(pts.join() === "0,10", "the stitch-out player's limit is followed");

  const dots = menuItems().find((m) => m.id === "d.needlePath.dots")!;
  check(dots.disabled?.() === false, "on: the dots and widths can be chosen");
  dots.run();
  menuItems().find((m) => m.id === "d.needlePath.width3")!.run();
  await Promise.resolve();
  check(needlePathSettings().dots && needlePathSettings().widthPx === 3, "the menu sets the dots and the width");
  check(menuItems().find((m) => m.id === "d.needlePath.width3")!.checked?.() === true, "the width chosen is ticked");

  await setNeedlePathSetting("enabled", false);
  check(activeStitchLine() === undefined, "d.4 off again: Filum's stitch line comes back");
  off();
  check(!toolbarButtons().some((b) => b.module === "d") && !menuItems().some((m) => m.module === "d"), "removed: nothing of module d left in the registry");
  done("needle path hook-up");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
