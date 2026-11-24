// Module e in module 0's spaces (#60): the preset card under Filum's fabric
// picker, the summary in the export dialog. Both close with their × and are
// not modal. A closed card comes back when another preset is put in force; a
// closed summary comes back the next time the export dialog opens.

import { useState } from "react";
import { useStore } from "../../store";
import { ExportSummary } from "./ExportSummary";
import { PresetCard } from "./PresetCard";

let cardClosedFor: string | null = null;

export function PresetCardSlot() {
  const doc = useStore((s) => s.doc);
  const id = doc.nova?.fabricPreset?.id ?? null;
  const [closed, setClosed] = useState(() => cardClosedFor);
  if (!id || closed === id) return null;
  return (
    <PresetCard
      doc={doc}
      onClose={() => {
        cardClosedFor = id;
        setClosed(id);
      }}
    />
  );
}

export function ExportSummarySlot() {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const [closed, setClosed] = useState(false);
  return closed ? null : <ExportSummary doc={doc} plan={plan} onClose={() => setClosed(true)} />;
}
