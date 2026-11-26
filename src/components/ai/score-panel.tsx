"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Gauge, Minus, Plus, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { cn, relativeTime, scoreTone } from "@/lib/utils";
import { parseScoreReason, type ScoreResponse } from "@/lib/ai/schemas";
import { SCORE_DIMENSIONS, parseScoreBreakdown, type ScoreBreakdown, type ScoreWeights } from "@/lib/ai/scoring";
import { CONFIDENCE } from "./research-panel";
import { RECHARGE_ACTION, RechargeLink, isNoCredits, noCreditsFrom } from "@/components/credits/no-credits";

export type ScorePanelProps = {
  leadId: string; score: number | null; scoreReason: string | null; scoreBreakdown: string | null; scoredAt: string | null; weights: ScoreWeights;
};

const TONE = {
  hot: { color: "var(--hot)", label: "Alto", hint: "Molto in linea con i tuoi criteri" },
  warm: { color: "var(--warm)", label: "Medio", hint: "In parte in linea con i tuoi criteri" },
  cold: { color: "var(--cold)", label: "Basso", hint: "Poco in linea con i tuoi criteri" },
  muted: { color: "var(--ink-3)", label: "—", hint: "Non ancora valutato" },
} as const;

/** Barre dei sotto-punteggi, con motivazione e peso dell'agente. */
export function DimensionBars({ breakdown, weights, compact }: { breakdown: ScoreBreakdown; weights?: ScoreWeights; compact?: boolean }) {
  return (
    <ul className={cn(compact ? "space-y-1.5" : "space-y-3")} aria-label="Punteggio per dimensione">
      {SCORE_DIMENSIONS.map((d) => {
        const x = breakdown.dimensions[d.id];
        const color = TONE[scoreTone(x.score)].color;
        return (
          <li key={d.id}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-medium text-ink" title={d.hint}>{d.label}</span>
              <span className="flex items-baseline gap-2">
                {weights && !compact && (
                  <span className="text-[11px] text-ink-3" title="Peso nel totale (lo regoli nel Profilo)">peso {weights[d.id]}</span>
                )}
                <span className="font-mono font-semibold tabular-nums">{x.score}</span>
              </span>
            </div>
            <div className={cn("mt-1 overflow-hidden rounded-full bg-surface-2", compact ? "h-1" : "h-1.5")} role="img" aria-label={`${d.label}: ${x.score} su 100`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, x.score)}%`, background: color, opacity: weights && weights[d.id] === 0 ? 0.35 : 1, transition: "width 600ms cubic-bezier(.2,.8,.2,1)" }} />
            </div>
            {!compact && x.reason && <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{x.reason}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function ScoreRing({ score, loading }: { score: number | null; loading?: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const tone = TONE[scoreTone(score)];
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative grid h-[84px] w-[84px] shrink-0 place-items-center" role="img" aria-label={score == null ? "Punteggio non calcolato" : `Punteggio ${score} su 100`}>
      <svg viewBox="0 0 80 80" className={cn("absolute inset-0 -rotate-90", loading && "animate-pulse")} aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={tone.color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="text-center leading-none">
        <div className="font-mono text-[26px] font-semibold tabular-nums tracking-tight">{score ?? "—"}</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">/100</div>
      </div>
    </div>
  );
}

export function ScorePanel({ leadId, score, scoreReason, scoreBreakdown, scoredAt, weights }: ScorePanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [noCredits, setNoCredits] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const reason = parseScoreReason(scoreReason);
  const breakdown = parseScoreBreakdown(scoreBreakdown);
  const conf = breakdown ? CONFIDENCE[breakdown.confidence] : null;
  const tone = TONE[scoreTone(score)];
  const busy = loading || refreshing;

  async function run() {
    setLoading(true);
    setNoCredits(null);
    try {
      const res = await fetch("/api/ai/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      const data = (await res.json().catch(() => null)) as (ScoreResponse & { error?: string }) | null;
      const nc = noCreditsFrom(res.status, data);
      if (nc) throw nc;
      if (!res.ok || !data?.results?.length) throw new Error(data?.error ?? data?.errors?.[0]?.error ?? "Valutazione non riuscita");
      toast(`Punteggio aggiornato: ${data.results[0].score}/100`);
      startTransition(() => router.refresh());
    } catch (e) {
      if (isNoCredits(e)) {
        setNoCredits(e.message);
        toast("Crediti esauriti", "error", RECHARGE_ACTION);
        return;
      }
      toast(e instanceof Error ? e.message : "Valutazione non riuscita", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5" aria-busy={busy}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Gauge className="h-4 w-4 text-ink-3" aria-hidden /> Punteggio AI
        </h2>
        <span className="flex items-center gap-1.5">
          {conf && <Badge tone={conf.tone} title="Quanto sono completi i dati su cui si basa la valutazione">{conf.label}</Badge>}
          {reason?.demo && <Badge tone="warn" title="Calcolato con l'euristica dimostrativa (nessuna chiave API)">Demo</Badge>}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ScoreRing score={score} loading={busy} />
        <div className="min-w-0">
          {score == null ? (
            <>
              <p className="font-medium">Non ancora valutato</p>
              <p className="mt-1 text-sm text-ink-2">L&apos;AI valuta il cliente su sei dimensioni secondo i tuoi criteri; il totale è la media pesata con i pesi che scegli nel Profilo.</p>
            </>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold" style={{ color: tone.color, background: `color-mix(in srgb, ${tone.color} 14%, transparent)` }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} aria-hidden />{tone.label}
                </span>
                <span className="text-ink-3">{tone.hint}</span>
              </p>
              {reason?.summary && <p className="mt-1.5 text-[14px] leading-snug text-ink">{reason.summary}</p>}
            </>
          )}
        </div>
      </div>

      {breakdown ? (
        <div className="mt-5 border-t border-line pt-4">
          <DimensionBars breakdown={breakdown} weights={weights} />
          <Link href="/app/settings#criteri" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />Criteri e pesi
          </Link>
        </div>
      ) : score != null ? (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">Calcolato con la versione precedente: ricalcola per vedere il dettaglio per dimensione.</p>
      ) : null}

      {reason && reason.factors.length > 0 && (
        <ul className="mt-5 space-y-2.5 border-t border-line pt-4" aria-label="Fattori del punteggio">
          {reason.factors.map((f, i) => {
            const pos = f.impact === "+";
            return (
              <li key={i} className="flex gap-2.5">
                <span
                  className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", pos ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}
                  aria-label={pos ? "Fattore positivo" : "Fattore negativo"}
                >
                  {pos ? <Plus className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 text-[13.5px] leading-snug">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-ink-2"> — {f.detail}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {noCredits && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <span className="min-w-0 flex-1">{noCredits}</span>
          <RechargeLink />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-3">
          {scoredAt ? <>Calcolato <time dateTime={scoredAt} suppressHydrationWarning>{relativeTime(scoredAt)}</time></> : "Mai calcolato"}
        </span>
        <Button size="sm" variant={score == null ? "primary" : "outline"} onClick={run} loading={busy}>
          {!busy && (score == null ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />)}
          {score == null ? "Valuta" : "Ricalcola"}
        </Button>
      </div>
    </Card>
  );
}
