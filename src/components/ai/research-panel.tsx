"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Check, CircleHelp, Copy, ExternalLink, FileSearch, Globe, Minus, Newspaper, Plus, RefreshCw, Search, Star,
  UserRound, UserPlus, Waypoints,
} from "lucide-react";
import { Badge, Button, Card, Dialog, Spinner, useToast } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  contactSuggestions, hostOf, parseResearch, researchToText, type Research, type ResearchContactSuggestion, type ResearchEvent, type Source,
} from "@/lib/ai/schemas";
import type { Confidence } from "@/lib/ai/scoring";
import { api } from "@/components/crm/client-api";
import { copyText, postNdjson } from "./ndjson";
import { RECHARGE_ACTION, RechargeLink, isNoCredits } from "@/components/credits/no-credits";

export type ResearchContacts = { phone: string | null; email: string | null; website: string | null; contactName: string | null };
export type ResearchPanelProps = { leadId: string; leadName: string; initialResearch: string | null; researchAt: string | null; contacts: ResearchContacts };

const PHASES = [
  { id: "context", label: "Rileggo dati e note" },
  { id: "research", label: "Cerco informazioni pubbliche" },
  { id: "writing", label: "Organizzo quello che ho trovato" },
  { id: "saving", label: "Salvo la scheda" },
] as const;
type PhaseId = (typeof PHASES)[number]["id"];

export const CONFIDENCE: Record<Confidence, { label: string; tone: "success" | "warn" | "danger"; hint: string }> = {
  alta: { label: "Affidabilità alta", tone: "success", hint: "Più fonti concordano sulle informazioni" },
  media: { label: "Affidabilità media", tone: "warn", hint: "Informazioni parziali: verifica i dettagli importanti" },
  bassa: { label: "Affidabilità bassa", tone: "danger", hint: "Trovato poco o nulla: verifica di persona" },
};

const FIELD_LABEL: Record<keyof ResearchContactSuggestion, string> = {
  phone: "Telefono", email: "Email", website: "Sito web", contactName: "Referente", contactRole: "Ruolo del referente",
};

export function ResearchPanel({ leadId, leadName, initialResearch, researchAt, contacts }: ResearchPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => parseResearch(initialResearch), [initialResearch]);
  const [research, setResearch] = useState<Research | null>(initial?.kind === "ok" ? initial.research : null);
  const [legacy, setLegacy] = useState(initial?.kind === "legacy");
  const [at, setAt] = useState<string | null>(researchAt);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseId | null>(null);
  const [status, setStatus] = useState("");
  const [liveSources, setLiveSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!running) {
      setResearch(initial?.kind === "ok" ? initial.research : null);
      setLegacy(initial?.kind === "legacy");
      setAt(researchAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si sincronizza solo quando cambiano le props dal server
  }, [initial, researchAt]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setNoCredits(false);
    setPhase("context");
    setStatus("Avvio…");
    setLiveSources([]);
    let finished = false;
    try {
      await postNdjson<ResearchEvent>("/api/ai/briefing", { leadId }, (e) => {
        if (e.type === "status") {
          setPhase(e.phase);
          setStatus(e.message);
        } else if (e.type === "source") {
          setLiveSources((s) => (s.some((x) => x.url === e.source.url) ? s : [...s, e.source]));
        } else if (e.type === "done") {
          finished = true;
          setResearch(e.research);
          setLegacy(false);
          setAt(e.researchAt);
        } else if (e.type === "error") {
          throw new Error(e.message);
        }
      }, ctrl.signal);
      if (!finished) throw new Error("La ricerca si è interrotta. Riprova.");
      toast("Scheda AI aggiornata");
      router.refresh();
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : "Ricerca non riuscita";
      setError(msg);
      if (isNoCredits(e)) {
        setNoCredits(true);
        toast("Crediti esauriti", "error", RECHARGE_ACTION);
      } else toast(msg, "error");
    } finally {
      if (abortRef.current === ctrl) {
        setRunning(false);
        setPhase(null);
      }
    }
  }

  async function copyAll() {
    if (!research) return;
    toast((await copyText(researchToText(research, leadName))) ? "Scheda copiata" : "Copia non riuscita", "info");
  }

  const conf = research ? CONFIDENCE[research.confidence] : null;

  return (
    <Card className="@container overflow-hidden" aria-busy={running} aria-labelledby="research-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileSearch className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <h2 id="research-title" className="text-[15px] font-semibold">Scheda AI</h2>
          {research && !running && conf && <Badge tone={conf.tone} title={conf.hint}>{conf.label}</Badge>}
          {research?.demo && !running && <Badge tone="warn" title="Contenuto dimostrativo: con la chiave API la scheda include la ricerca web">Demo</Badge>}
        </div>
        {research && !running && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={copyAll}><Copy className="h-3.5 w-3.5" aria-hidden />Copia</Button>
            <Button size="sm" variant="outline" onClick={generate}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Aggiorna</Button>
          </div>
        )}
      </div>

      {running ? (
        <Progress phase={phase} status={status} sources={liveSources} />
      ) : research ? (
        <ResearchView research={research} at={at} leadId={leadId} contacts={contacts} />
      ) : legacy ? (
        <div className="flex flex-col items-center px-6 py-9 text-center">
          <p className="text-[15px] font-semibold">Scheda creata con la versione precedente</p>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            La Scheda AI ora raccoglie solo informazioni sul cliente, con le fonti. Aggiornala per vederla nel nuovo formato.
          </p>
          {error && <ErrorBox error={error} noCredits={noCredits} />}
          <Button className="mt-5" onClick={generate}><RefreshCw className="h-4 w-4" aria-hidden />Aggiorna</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Search className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="text-[15px] font-semibold">Informazioni pubbliche sul cliente</h3>
          <p className="mt-1 max-w-md text-sm text-ink-2">
            L&apos;AI cerca sul web cosa fa l&apos;attività, orari, persone citate, recensioni, notizie e segnali utili. Ogni dato con la sua fonte; quello che non trova lo segnala.
          </p>
          {error && <ErrorBox error={error} noCredits={noCredits} />}
          <Button className="mt-5" onClick={generate}><Search className="h-4 w-4" aria-hidden />Cerca informazioni</Button>
        </div>
      )}
      {error && research && !running && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-danger-soft px-5 py-2.5 text-sm text-danger" role="alert">
          <p className="min-w-0 flex-1">{error}</p>
          {noCredits && <RechargeLink />}
        </div>
      )}
    </Card>
  );
}

function ErrorBox({ error, noCredits }: { error: string; noCredits: boolean }) {
  return (
    <div className="mt-3 flex max-w-sm flex-col items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      <p>{error}</p>
      {noCredits && <RechargeLink />}
    </div>
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

function Section({ icon: Icon, title, children, className }: { icon: typeof Search; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <Icon className="h-3.5 w-3.5" aria-hidden />{title}
      </h3>
      {children}
    </section>
  );
}

function SourceLink({ url, label }: { url: string; label?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url}
      className="inline-flex max-w-full items-center gap-1 text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
      <span className="truncate">{label ?? hostOf(url)}</span><ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

const fmtRating = (r: number) => r.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function ResearchView({ research: r, at, leadId, contacts }: { research: Research; at: string | null; leadId: string; contacts: ResearchContacts }) {
  const b = r.business;
  const facts: [string, string | null][] = [
    ["Tipo", b.type], ["Cosa offre", b.offering], ["Orari", b.openingHours], ["Prezzi", b.priceLevel],
    ["Attiva dal", b.foundedOrSince], ["Dimensione", b.size], ["Sedi", b.locations.length ? b.locations.join(" · ") : null],
  ];
  const shownFacts = facts.filter(([, v]) => v);
  const links = [
    ...(r.online.website ? [{ name: "Sito", url: r.online.website, detail: null as string | null }] : []),
    ...r.online.socials.map((s) => ({ name: s.platform, url: s.url, detail: null as string | null })),
    ...r.online.otherListings.map((l) => ({ name: l.name, url: l.url, detail: l.detail })),
  ];
  const rep = r.reputation;
  const hasOnline = r.online.googleRating != null || links.length > 0 || rep.overall || rep.positives.length || rep.negatives.length || r.online.phone || r.online.email;

  return (
    <div className="space-y-6 px-5 py-5">
      <p className="text-[15.5px] leading-relaxed text-ink">{r.summary}</p>

      <SaveContacts research={r} leadId={leadId} contacts={contacts} />

      <div className="grid gap-6 @2xl:grid-cols-2">
        {shownFacts.length > 0 && (
          <Section icon={Building2} title="Attività">
            <dl className="space-y-1.5 text-[14px] leading-snug">
              {shownFacts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                  <dt className="text-ink-3">{k}</dt><dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}
        <Section icon={UserRound} title="Persone">
          {r.people.length ? (
            <ul className="space-y-2">
              {r.people.map((p) => (
                <li key={p.name} className="text-[14px] leading-snug">
                  <span className="font-medium">{p.name}</span>{p.role && <span className="text-ink-2"> — {p.role}</span>}
                  {p.source && (
                    <div className="mt-0.5">{/^https?:\/\//i.test(p.source) ? <SourceLink url={p.source} /> : <span className="text-[12px] text-ink-3">Fonte: {p.source}</span>}</div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-[13.5px] text-ink-3">Nessun titolare o referente citato pubblicamente.</p>}
        </Section>
      </div>

      {hasOnline && (
        <Section icon={Star} title="Online e recensioni">
          <div className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-4 py-3">
              {r.online.googleRating != null && (
                <p className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[22px] font-semibold tabular-nums">{fmtRating(r.online.googleRating)}</span>
                  <span className="text-[12.5px] text-ink-3">/5 su Google{r.online.reviewsCount != null && ` · ${r.online.reviewsCount.toLocaleString("it-IT")} recensioni`}</span>
                </p>
              )}
              {(r.online.phone || r.online.email) && (
                <p className="text-[13px] text-ink-2">{[r.online.phone, r.online.email].filter(Boolean).join(" · ")}</p>
              )}
              {links.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {links.map((l, i) => (
                    <li key={`${l.name}-${i}`} className="max-w-full">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition hover:border-line-strong hover:text-ink">
                          <span className="truncate font-medium">{l.name}</span>{l.detail && <span className="truncate text-ink-3">{l.detail}</span>}
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                          <span className="font-medium">{l.name}</span>{l.detail && <span className="truncate text-ink-3">{l.detail}</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(rep.overall || rep.positives.length > 0 || rep.negatives.length > 0) && (
              <div className="space-y-3 px-4 py-3">
                {rep.overall && <p className="text-[14px] leading-relaxed text-ink-2">{rep.overall}</p>}
                {(rep.positives.length > 0 || rep.negatives.length > 0) && (
                  <div className="grid gap-4 @lg:grid-cols-2">
                    <ReviewList items={rep.positives} positive />
                    <ReviewList items={rep.negatives} />
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {r.facts.length > 0 && (
        <Section icon={Newspaper} title="Fatti">
          <ul className="space-y-2">
            {r.facts.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-snug">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
                <span className="min-w-0">{f.text}{f.sourceUrl && <> <SourceLink url={f.sourceUrl} /></>}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.signals.length > 0 && (
        <Section icon={Waypoints} title="Segnali">
          <ul className="grid gap-2 @lg:grid-cols-2">
            {r.signals.map((s, i) => (
              <li key={i} className="rounded-xl bg-surface-2/70 px-3.5 py-2.5">
                <p className="text-[13.5px] font-medium">{s.label}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{s.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.unknowns.length > 0 && (
        <Section icon={CircleHelp} title="Da verificare">
          <ul className="flex flex-wrap gap-1.5">
            {r.unknowns.map((u) => (
              <li key={u} className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[12.5px] text-ink-2">{u}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.sources.length > 0 && (
        <Section icon={Globe} title="Fonti">
          <ul className="flex flex-wrap gap-1.5">
            {r.sources.map((s) => (
              <li key={s.url} className="max-w-full">
                <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition hover:border-line-strong hover:text-ink">
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
          Aggiornata il {formatDate(at, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
          {r.demo && " · contenuto dimostrativo, senza ricerca web"}
        </p>
      )}
    </div>
  );
}

function ReviewList({ items, positive }: { items: string[]; positive?: boolean }) {
  if (!items.length) return <p className="text-[13px] text-ink-3">{positive ? "Nessun aspetto positivo ricorrente." : "Nessuna critica ricorrente."}</p>;
  return (
    <ul className="space-y-1.5" aria-label={positive ? "Aspetti apprezzati" : "Critiche ricorrenti"}>
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[13.5px] leading-snug">
          <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} aria-hidden>
            {positive ? <Plus className="h-2.5 w-2.5" strokeWidth={3} /> : <Minus className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Propone di copiare nella scheda cliente i recapiti trovati dalla ricerca che oggi mancano. */
function SaveContacts({ research, leadId, contacts }: { research: Research; leadId: string; contacts: ResearchContacts }) {
  const router = useRouter();
  const toast = useToast();
  const suggestions = useMemo(() => contactSuggestions(research, contacts), [research, contacts]);
  const keys = Object.keys(suggestions) as (keyof ResearchContactSuggestion)[];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  if (!keys.length) return null;

  async function save() {
    const body = Object.fromEntries(keys.filter((k) => picked.has(k)).map((k) => [k, suggestions[k]]));
    if (!Object.keys(body).length) return setOpen(false);
    setSaving(true);
    const res = await api(`/api/leads/${leadId}`, "PATCH", body);
    setSaving(false);
    if (!res.ok) return toast(res.error, "error");
    setOpen(false);
    toast("Dati del cliente aggiornati");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
        <UserPlus className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-[13.5px]">
          Trovati dati che mancano nella scheda: <span className="font-medium">{keys.filter((k) => k !== "contactRole").map((k) => FIELD_LABEL[k].toLowerCase()).join(", ")}</span>.
        </p>
        <Button size="sm" variant="outline" onClick={() => { setPicked(new Set(keys)); setOpen(true); }}>Salva nei dati del cliente</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Salvare questi dati nella scheda?">
        <p className="text-sm text-ink-2">Sono stati trovati dalla ricerca: controlla che siano corretti prima di salvarli.</p>
        <ul className="mt-4 space-y-2">
          {keys.map((k) => (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-surface-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={picked.has(k)}
                  onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink-3">{FIELD_LABEL[k]}</span>
                  <span className="block break-words text-[14px]">{suggestions[k]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
          <Button onClick={save} loading={saving} disabled={!picked.size}>Salva {picked.size ? `(${picked.size})` : ""}</Button>
        </div>
      </Dialog>
    </>
  );
}
