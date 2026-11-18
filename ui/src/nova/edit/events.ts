// Module f's event (contract, «f — Libreria e modifica»): a patch reaches beyond the hoop.

import type { Vec2 } from "../../types";
import { emit, on } from "../core/events";
import { useStore } from "../../store";
import { findGroup, groupOf, overflow } from "./patch";

declare module "../core/events" {
  interface NovaEvents {
    /** overflow: mm beyond the hoop in x and in y; propose: the command offered to fix it. */
    "patch.outsideHoop": { groupId: string; overflow: Vec2; propose: "f.patch.center" };
  }
}

/** After a patch is created or centred: patch.outsideHoop when it does not fit the hoop. */
export function watchOverflow(): () => void {
  return on("command.executed", ({ id, params }) => {
    if (id !== "f.patch.create" && id !== "f.patch.center") return;
    const doc = useStore.getState().doc;
    const p = params as { groupId?: string; sourceIds?: string[] } | undefined;
    // a new patch: the group whose source is the one asked for (an object is in one group at most)
    const groupId = id === "f.patch.center" ? p?.groupId : p?.sourceIds?.length ? groupOf(doc, p.sourceIds[0])?.id : undefined;
    if (!groupId || !findGroup(doc, groupId)) return;
    const over = overflow(doc, groupId);
    if (over[0] > 0 || over[1] > 0) emit("patch.outsideHoop", { groupId, overflow: over, propose: "f.patch.center" });
  });
}
