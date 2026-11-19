// The registered components of one space (nova/core/slots.ts), each in a box marked data-nova.

import { createElement } from "react";
import { slotEntries, useSlots, type SlotName, type SlotProps } from "./slots";

export function NovaSlot<S extends SlotName>({ name, props }: { name: S; props: SlotProps[S] }) {
  useSlots();
  return (
    <>
      {slotEntries(name).map((e) => (
        <div key={e.id} data-nova={e.module} data-nova-slot={name}>
          {createElement(e.Component, props)}
        </div>
      ))}
    </>
  );
}
