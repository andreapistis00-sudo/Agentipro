"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Select, Textarea, useToast } from "@/components/ui";

type Profile = { name: string; company: string | null; sector: string | null; products: string | null; idealCustomer: string | null; territory: string | null; tone: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    setLoading(false);
    if (!res.ok) return toast((await res.json().catch(() => ({}))).error ?? "Errore nel salvataggio", "error");
    toast("Profilo salvato");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome" htmlFor="name"><Input id="name" name="name" defaultValue={profile.name} required /></Field>
          <Field label="Azienda o mandante" htmlFor="company"><Input id="company" name="company" defaultValue={profile.company ?? ""} placeholder="Es. Caffè Aurora S.r.l." /></Field>
          <Field label="Settore" htmlFor="sector"><Input id="sector" name="sector" defaultValue={profile.sector ?? ""} placeholder="Es. Forniture per bar e ristoranti" /></Field>
          <Field label="Territorio" htmlFor="territory"><Input id="territory" name="territory" defaultValue={profile.territory ?? ""} placeholder="Es. Milano e provincia" /></Field>
        </div>
        <Field label="Cosa vendi" htmlFor="products" hint="Prodotti, servizi, punti di forza, prezzi indicativi, condizioni. Più dettagli dai, più l'AI sarà precisa.">
          <Textarea id="products" name="products" rows={4} defaultValue={profile.products ?? ""}
            placeholder="Es. Caffè in grani e capsule, macchine in comodato d'uso gratuito, assistenza tecnica in 24h..." />
        </Field>
        <Field label="Il tuo cliente ideale" htmlFor="idealCustomer" hint="Chi compra di più da te? Tipo di attività, dimensione, caratteristiche.">
          <Textarea id="idealCustomer" name="idealCustomer" rows={3} defaultValue={profile.idealCustomer ?? ""}
            placeholder="Es. Bar e pasticcerie con buon passaggio, aperti a colazione, che oggi usano un fornitore della grande distribuzione." />
        </Field>
        <Field label="Tono dei messaggi" htmlFor="tone">
          <Select id="tone" name="tone" defaultValue={profile.tone ?? "Professionale e cordiale"}>
            <option>Professionale e cordiale</option>
            <option>Diretto e sintetico</option>
            <option>Caloroso e informale</option>
            <option>Formale</option>
          </Select>
        </Field>
        <div className="flex justify-end"><Button type="submit" loading={loading}>Salva profilo</Button></div>
      </Card>
    </form>
  );
}
