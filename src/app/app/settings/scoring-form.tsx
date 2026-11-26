"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Card, Field, Textarea, useToast } from "@/components/ui";
import { DEFAULT_WEIGHTS, MAX_WEIGHT, SCORE_DIMENSIONS, type ScoreWeights } from "@/lib/ai/scoring";

const WEIGHT_LABEL = ["Non conta", "Conta poco", "Conta poco", "Conta", "Conta molto", "Decisiva"];

export function ScoringForm({ criteria, weights: initial }: { criteria: string | null; weights: ScoreWeights }) {
  const router = useRouter();
  const toast = useToast();
  const [weights, setWeights] = useState<ScoreWeights>(initial);
  const [text, setText] = useState(criteria ?? "");
  const [saving, setSaving] = useState(false);
  const total = SCORE_DIMENSIONS.reduce((s, d) => s + weights[d.id], 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/profile/scoring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: text, weights }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(data.error ?? "Errore nel salvataggio", "error");
    toast(data.updated ? `Criteri salvati · ${data.updated} ${data.updated === 1 ? "punteggio ricalcolato" : "punteggi ricalcolati"}` : "Criteri salvati");
    router.refresh();
  }

  return (
    <form onSubmit={save} id="criteri" className="mt-6 scroll-mt-6">
      <Card className="space-y-6 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Come valuti un cliente</h2>
          <p className="mt-1 text-sm text-ink-2">
            Il punteggio AI valuta ogni cliente su sei dimensioni. Il totale è la media pesata con i pesi qui sotto:
            se li cambi, i punteggi dei clienti già valutati si ricalcolano subito, senza consumare crediti.
          </p>
        </div>
        <Field label="I tuoi criteri" htmlFor="scoringCriteria" hint="Scrivi con parole tue cosa rende un cliente più o meno interessante. L'AI ne tiene conto nelle prossime valutazioni.">
          <Textarea id="scoringCriteria" rows={3} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Es. Conta di più se fa gelato artigianale e ha un laboratorio interno; meno se è una catena o un franchising." />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium">Pesi delle dimensioni</legend>
          <ul className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {SCORE_DIMENSIONS.map((d) => {
              const w = weights[d.id];
              const pct = total ? Math.round((w / total) * 100) : 0;
              return (
                <li key={d.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={`w-${d.id}`} className="text-[14px] font-medium">{d.label}</label>
                    <span className="text-[12px] text-ink-3"><span className="font-mono font-semibold text-ink">{w}</span>/{MAX_WEIGHT} · {WEIGHT_LABEL[w]}{total ? ` · ${pct}%` : ""}</span>
                  </div>
                  <p className="text-[12.5px] text-ink-3">{d.hint}</p>
                  <input
                    id={`w-${d.id}`} type="range" min={0} max={MAX_WEIGHT} step={1} value={w}
                    onChange={(e) => setWeights((x) => ({ ...x, [d.id]: Number(e.target.value) }))}
                    aria-valuetext={`${w} su ${MAX_WEIGHT}, ${WEIGHT_LABEL[w]}`}
                    className="mt-2 w-full accent-[var(--accent)]"
                  />
                </li>
              );
            })}
          </ul>
          {total === 0 && <p className="mt-3 text-[12.5px] text-warn">Con tutti i pesi a zero il totale diventa la media semplice delle dimensioni.</p>}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />Pesi predefiniti
          </Button>
          <Button type="submit" loading={saving}>Salva criteri e pesi</Button>
        </div>
      </Card>
    </form>
  );
}
