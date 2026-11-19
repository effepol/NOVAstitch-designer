// Module b, part 2: the menu a click on a connection line opens, on the canvas
// (Filum's own Menu component, with module b's items). The canvas keeps its own
// context menu to itself, so the menu is mounted here, in a container marked
// data-nova="b" like everything a module shows (rule i.3).

import { createElement } from "react";
import type { MenuItem } from "../../components/menuModel";

type Opener = (items: MenuItem[], x: number, y: number) => void;

let close: (() => void) | null = null;

/** In the app: Filum's Menu at the click, closed by a choice, Esc or a click elsewhere. */
const domOpener: Opener = (items, x, y) => {
  close?.();
  const host = document.createElement("div");
  host.setAttribute("data-nova", "b");
  document.body.appendChild(host);
  void Promise.all([import("react-dom/client"), import("../../components/MenuBar")]).then(([{ createRoot }, { Menu }]) => {
    const root = createRoot(host);
    close = () => {
      close = null;
      root.unmount();
      host.remove();
    };
    root.render(createElement(Menu, { items, x, y, onClose: () => close?.() }));
  });
};

let opener: Opener = domOpener;

/** Opens the menu at the click (screen coordinates). */
export const openMenu: Opener = (items, x, y) => opener(items, x, y);

/** Tests: where the menu goes instead of the screen (null: back to the screen). */
export function setMenuOpener(fn: Opener | null): void {
  opener = fn ?? domOpener;
}
