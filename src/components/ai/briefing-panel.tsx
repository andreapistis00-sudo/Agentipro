"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Check, ChevronDown, ClipboardList, Copy, ExternalLink, Gift, Globe, HelpCircle, Lightbulb,
  MessageSquareQuote, RefreshCw, Shield, Sparkles, Target,
} from "lucide-react";
import { Badge, Button, Card, Spinner, useToast } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { briefingToText, hostOf, parseBriefing, type Briefing, type BriefingEvent, type Source } from "@/lib/ai/schemas";
import { copyText, postNdjson } from "./ndjson";

export type BriefingPanelProps = { leadId: string; initialBriefing: string | null; briefingAt: string | null };

const PHASES = [
  { id: "context", label: "Rileggo scheda e storico" },
  { id: "research", label: "Cerco informazioni pubbliche" },
  { id: "writing", label: "Scrivo il briefing" },
  { id: "saving", label: "Salvo nella scheda" },
] as const;
type PhaseId = (typeof PHASES)[number]["id"];

export function BriefingPanel({ leadId, initialBriefing, briefingAt }: BriefingPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => parseBriefing(initialBriefing), [initialBriefing]);
  const [briefing, setBriefing] = useState<Briefing | null>(initial);
  const [at, setAt] = useState<string | null>(briefingAt);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseId | null>(null);
  const [status, setStatus] = useState("");
  const [liveSources, setLiveSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!running) {
      setBriefing(initial);
      setAt(briefingAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si sincronizza solo quando cambiano le props dal server
  }, [initial, briefingAt]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setPhase("context");
    setStatus("Avvio…");
    setLiveSources([]);
    let finished = false;
    try {
      await postNdjson<BriefingEvent>("/api/ai/briefing", { leadId }, (e) => {
        if (e.type === "status") {
          setPhase(e.phase);
          setStatus(e.message);
        } else if (e.type === "source") {
          setLiveSources((s) => (s.some((x) => x.url === e.source.url) ? s : [...s, e.source]));
        } else if (e.type === "done") {
          finished = true;
          setBriefing(e.briefing);
          setAt(e.briefingAt);
        } else if (e.type === "error") {
          throw new Error(e.message);
        }
      }, ctrl.signal);
      if (!finished) throw new Error("La generazione si è interrotta. Riprova.");
      toast("Briefing pronto");
      router.refresh();
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : "Generazione non riuscita";
      setError(msg);
      toast(msg, "error");
    } finally {
      if (abortRef.current === ctrl) {
        setRunning(false);
        setPhase(null);
      }
    }
  }

  async function copyAll() {
    if (!briefing) return;
    toast((await copyText(briefingToText(briefing))) ? "Briefing copiato" : "Copia non riuscita", "info");
  }

  return (
    <Card className="@container overflow-hidden" aria-busy={running}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <h2 className="text-[15px] font-semibold">Briefing pre-visita</h2>
          {briefing?.demo && <Badge tone="warn" title="Contenuto dimostrativo: aggiungi la chiave API per briefing reali con ricerca web">Demo</Badge>}
        </div>
        {briefing && !running && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={copyAll}><Copy className="h-3.5 w-3.5" aria-hidden />Copia tutto</Button>
            <Button size="sm" variant="outline" onClick={generate}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Rigenera</Button>
          </div>
        )}
      </div>

      {running ? (
        <Progress phase={phase} status={status} sources={liveSources} />
      ) : briefing ? (
        <BriefingView briefing={briefing} at={at} />
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="text-[15px] font-semibold">Arriva preparato alla visita</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            In meno di un minuto: chi è il cliente, perché visitarlo ora, frase d&apos;apertura, obiezioni probabili e prossimo passo.
          </p>
          {error && <p className="mt-3 max-w-sm rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button className="mt-5" onClick={generate}><Sparkles className="h-4 w-4" aria-hidden />Prepara la visita</Button>
        </div>
      )}
      {error && briefing && !running && (
        <p className="border-t border-line bg-danger-soft px-5 py-2.5 text-sm text-danger" role="alert">{error}</p>
      )}
    </Card>
  );
}

function Progress({ phase, status, sources }: { phase: PhaseId | null; status: string; sources: Source[] }) {
  const current = PHASES.findIndex((p) => p.id === phase);
  return (
    <div className="px-5 py-6" role="status" aria-live="polite">
      <ol className="space-y-3">
        {PHASES.map((p, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={p.id} className="flex items-center gap-3">
              <span className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                done ? "border-success bg-success text-white" : active ? "border-ink bg-surface" : "border-line text-ink-3",
              )}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : active ? <Spinner className="h-3.5 w-3.5 text-ink" /> : i + 1}
              </span>
              <span className={cn("text-sm", active ? "font-medium text-ink" : done ? "text-ink-2" : "text-ink-3")}>{p.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 truncate text-sm text-ink-2">{status}</p>
      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span key={s.url} className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
              <Globe className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{hostOf(s.url)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-6 space-y-2.5" aria-hidden>
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, className }: { icon: typeof Target; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <Icon className="h-3.5 w-3.5" aria-hidden />{title}
      </h3>
      {children}
    </section>
  );
}

function BriefingView({ briefing: b, at }: { briefing: Briefing; at: string | null }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyOpening() {
    if (await copyText(b.openingLine)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else toast("Copia non riuscita", "error");
  }

  return (
    <div className="space-y-6 px-5 py-5">
      {/* Frase d'apertura */}
      <div className="rounded-2xl border border-accent/25 bg-accent-soft p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-accent">
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />Frase d&apos;apertura
          </span>
          <button
            onClick={copyOpening}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
            aria-label="Copia la frase d'apertura"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copiata" : "Copia"}
          </button>
        </div>
        <p className="font-display text-[19px] leading-snug text-ink">«{b.openingLine}»</p>
      </div>

      <div className="grid gap-6 @2xl:grid-cols-2">
        <Section icon={Target} title="In sintesi">
          <p className="text-[14.5px] leading-relaxed">{b.snapshot}</p>
        </Section>
        <Section icon={Lightbulb} title="Perché ora">
          <p className="text-[14.5px] leading-relaxed">{b.whyNow}</p>
        </Section>
      </div>

      <Section icon={ArrowRight} title="Argomenti da toccare">
        <ol className="space-y-2">
          {b.talkingPoints.map((t, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-snug">
              <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-ink-2">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-6 @2xl:grid-cols-2">
        <Section icon={Gift} title="Offerta da proporre">
          <p className="rounded-xl border border-line bg-surface-2/60 p-3 text-[14.5px] leading-relaxed">{b.offerToPropose}</p>
        </Section>
        <Section icon={HelpCircle} title="Domande da fare">
          <ul className="space-y-1.5">
            {b.questionsToAsk.map((q, i) => (
              <li key={i} className="flex gap-2 text-[14.5px] leading-snug">
                <span className="text-ink-3" aria-hidden>?</span><span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section icon={Shield} title="Obiezioni probabili">
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {b.likelyObjections.map((o, i) => (
            <details key={i} className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[14px] font-medium hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span>«{o.objection}»</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="border-l-2 border-accent mx-3.5 mb-3 pl-3 text-[14px] leading-relaxed text-ink-2">{o.response}</p>
            </details>
          ))}
        </div>
      </Section>

      <div className="flex gap-3 rounded-2xl bg-ink p-4 text-bg">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] opacity-60">Prossimo passo</div>
          <p className="mt-1 text-[14.5px] leading-snug">{b.nextStep}</p>
        </div>
      </div>

      {b.sources.length > 0 && (
        <Section icon={Globe} title="Fonti">
          <ul className="flex flex-wrap gap-1.5">
            {b.sources.map((s) => (
              <li key={s.url} className="max-w-full">
                <a
                  href={s.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition hover:border-line-strong hover:text-ink"
                  title={s.url}
                >
                  <span className="truncate">{s.title}</span>
                  <span className="shrink-0 text-ink-3">· {hostOf(s.url)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {at && (
        <p className="text-xs text-ink-3">
          Generato il {formatDate(at, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
          {b.demo && " · contenuto dimostrativo"}
        </p>
      )}
    </div>
  );
}
