"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog, Field, Input, Textarea, useToast } from "@/components/ui";
import type { LeadDTO } from "@/lib/crm/types";
import { StageSelect } from "./bits";
import { api } from "./client-api";

export function NewLeadButton({ size = "md", variant = "primary", label = "Nuovo cliente" }: { size?: "sm" | "md"; variant?: "primary" | "outline"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />{label}</Button>
      <NewLeadDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function NewLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("new");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setLoading(true);
    const res = await api<{ lead: LeadDTO }>("/api/leads", "POST", { ...f, stage, value: f.value || null });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    toast("Cliente creato");
    onClose();
    router.push(`/app/leads/${res.data.lead.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nuovo cliente" className="sm:max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome attività *" htmlFor="nl-name"><Input id="nl-name" name="name" required maxLength={160} autoFocus placeholder="Es. Bar Centrale" /></Field>
          </div>
          <Field label="Categoria" htmlFor="nl-category"><Input id="nl-category" name="category" placeholder="Es. Bar pasticceria" /></Field>
          <Field label="Fase" htmlFor="nl-stage"><StageSelect id="nl-stage" value={stage} onChange={setStage} /></Field>
          <Field label="Indirizzo" htmlFor="nl-address"><Input id="nl-address" name="address" placeholder="Via, numero civico" /></Field>
          <Field label="Città" htmlFor="nl-city"><Input id="nl-city" name="city" placeholder="Es. Milano" /></Field>
          <Field label="Telefono" htmlFor="nl-phone"><Input id="nl-phone" name="phone" type="tel" inputMode="tel" placeholder="+39 02 …" /></Field>
          <Field label="Email" htmlFor="nl-email"><Input id="nl-email" name="email" type="email" placeholder="nome@azienda.it" /></Field>
          <Field label="Referente" htmlFor="nl-contact"><Input id="nl-contact" name="contactName" placeholder="Nome e cognome" /></Field>
          <Field label="Ruolo" htmlFor="nl-role"><Input id="nl-role" name="contactRole" placeholder="Es. Titolare" /></Field>
          <Field label="Valore potenziale (€)" htmlFor="nl-value"><Input id="nl-value" name="value" inputMode="decimal" placeholder="Es. 5000" /></Field>
          <Field label="Tag" htmlFor="nl-tags" hint="Separati da virgola"><Input id="nl-tags" name="tags" placeholder="colazioni, priorità" /></Field>
          <div className="sm:col-span-2">
            <Field label="Sito web" htmlFor="nl-website"><Input id="nl-website" name="website" placeholder="www.esempio.it" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Note" htmlFor="nl-notes"><Textarea id="nl-notes" name="notes" rows={3} placeholder="Cosa sai già di questo cliente?" /></Field>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" loading={loading}>Crea cliente</Button>
        </div>
      </form>
    </Dialog>
  );
}
