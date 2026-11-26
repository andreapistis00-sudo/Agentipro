"use client";
import { useState } from "react";
import { Button, Dialog, Field, Input } from "@/components/ui";

export const LOST_REASONS = ["Prezzo troppo alto", "Rimasto con il fornitore attuale", "Volumi troppo bassi", "Non interessato", "Attività chiusa"];

/** Chiede (facoltativamente) il motivo per cui un cliente è stato perso. */
export function LostReasonDialog({ open, leadName, onConfirm, onCancel }: {
  open: boolean; leadName?: string; onConfirm: (reason: string | null) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const close = () => { setReason(""); onCancel(); };
  const confirm = (r: string | null) => { setReason(""); onConfirm(r); };
  return (
    <Dialog open={open} onClose={close} title="Perché è stato perso?">
      <form onSubmit={(e) => { e.preventDefault(); confirm(reason.trim() || null); }} className="space-y-4">
        <p className="text-sm text-ink-2">
          {leadName ? <><span className="font-medium text-ink">{leadName}</span> passa a “Perso”. </> : null}
          Annotare il motivo ti aiuta a capire cosa migliorare. È facoltativo.
        </p>
        <div className="flex flex-wrap gap-2">
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1 text-[13px] transition ${reason === r ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
              {r}
            </button>
          ))}
        </div>
        <Field label="Motivo" htmlFor="lost-reason">
          <Input id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Es. ha firmato con un concorrente" maxLength={500} autoFocus />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close}>Annulla spostamento</Button>
          <Button type="button" variant="outline" onClick={() => confirm(null)}>Salta</Button>
          <Button type="submit">Segna come perso</Button>
        </div>
      </form>
    </Dialog>
  );
}
