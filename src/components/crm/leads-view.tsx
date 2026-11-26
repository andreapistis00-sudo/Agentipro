"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Phone, Search, Sparkles, Trash2, Users, X, ArrowRightLeft, SlidersHorizontal } from "lucide-react";
import { Button, Dialog, EmptyState, Input, ScoreBadge, Select, StageBadge, useToast } from "@/components/ui";
import { cn, formatEuro, STAGES } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { telHref } from "@/lib/crm/format";
import type { LeadDTO } from "@/lib/crm/types";
import { FollowUpBadge } from "./bits";
import { api } from "./client-api";
import { LostReasonDialog } from "./lost-reason-dialog";
import { NewLeadButton } from "./new-lead-dialog";

export type LeadsQuery = { q?: string; stage?: string; minScore?: number; tag?: string; sort: string; page: number };

const SORT_OPTIONS = [
  { id: "updated", label: "Ultima modifica" },
  { id: "score", label: "Punteggio" },
  { id: "followup", label: "Prossimo follow-up" },
  { id: "value", label: "Valore" },
  { id: "name", label: "Nome (A-Z)" },
  { id: "created", label: "Più recenti" },
];

export function LeadsView({ leads, total, pages, query, tags, hasAnyLead }: {
  leads: LeadDTO[]; total: number; pages: number; query: LeadsQuery; tags: string[]; hasAnyLead: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [askLost, setAskLost] = useState(false);
  const [busy, setBusy] = useState<null | "stage" | "delete" | "ai">(null);
  const [showFilters, setShowFilters] = useState(Boolean(query.stage || query.minScore || query.tag));

  // Mantieni solo le selezioni ancora visibili quando cambia la pagina/filtro.
  const visibleIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);
  const sel = useMemo(() => new Set([...selected].filter((id) => visibleIds.has(id))), [selected, visibleIds]);

  function navigate(patch: Partial<LeadsQuery>) {
    const next = { ...query, page: 1, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.stage) p.set("stage", next.stage);
    if (next.minScore) p.set("minScore", String(next.minScore));
    if (next.tag) p.set("tag", next.tag);
    if (next.sort && next.sort !== "updated") p.set("sort", next.sort);
    if (next.page > 1) p.set("page", String(next.page));
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Ricerca con debounce
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if ((query.q ?? "") !== search.trim()) navigate({ q: search.trim() || undefined }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const exportHref = useMemo(() => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.stage) p.set("stage", query.stage);
    if (query.minScore) p.set("minScore", String(query.minScore));
    if (query.tag) p.set("tag", query.tag);
    p.set("sort", query.sort);
    return `/api/leads/export?${p}`;
  }, [query]);

  const filtersActive = Boolean(query.q || query.stage || query.minScore || query.tag);
  const allChecked = leads.length > 0 && leads.every((l) => sel.has(l.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(leads.map((l) => l.id)));

  async function bulkStage(stage: string, lostReason?: string | null) {
    setBusy("stage");
    const res = await api<{ updated: number }>("/api/leads", "PATCH", { ids: [...sel], stage, lostReason });
    setBusy(null);
    if (!res.ok) return toast(res.error, "error");
    toast(res.data.updated === 1 ? "1 cliente spostato" : `${res.data.updated} clienti spostati`);
    setSelected(new Set());
    router.refresh();
  }

  async function bulkDelete() {
    setBusy("delete");
    const res = await api<{ deleted: number }>("/api/leads", "DELETE", { ids: [...sel] });
    setBusy(null);
    setConfirmDelete(false);
    if (!res.ok) return toast(res.error, "error");
    toast(res.data.deleted === 1 ? "Cliente eliminato" : `${res.data.deleted} clienti eliminati`);
    setSelected(new Set());
    router.refresh();
  }

  async function bulkScore() {
    setBusy("ai");
    const res = await api<{ results?: { leadId: string; score: number }[] }>("/api/ai/score", "POST", { leadIds: [...sel] });
    setBusy(null);
    if (!res.ok) {
      return toast(res.status === 404 ? "La valutazione AI non è ancora disponibile." : `Valutazione non riuscita: ${res.error}`, "error");
    }
    const n = res.data.results?.length ?? 0;
    toast(n === 1 ? "1 cliente valutato" : `${n} clienti valutati`);
    setSelected(new Set());
    router.refresh();
  }

  if (!hasAnyLead) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Ancora nessun cliente"
        description="Cerca attività nella tua zona e importale con un clic, oppure aggiungi a mano un cliente che conosci già."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/search"><Button variant="secondary"><Search className="h-4 w-4" />Trova clienti</Button></Link>
            <NewLeadButton variant="outline" />
          </div>
        }
      />
    );
  }

  return (
    <div className={cn(sel.size > 0 && "pb-24")}>
      {/* Barra filtri */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome, città, categoria, referente…" className="pl-9" aria-label="Cerca clienti" />
          </div>
          <Button variant="outline" className="h-10 sm:hidden" size="icon" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="Filtri">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div className={cn("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center", !showFilters && "hidden sm:flex")}>
          <Select aria-label="Filtra per fase" value={query.stage ?? ""} onChange={(e) => navigate({ stage: e.target.value || undefined })} className="sm:w-44">
            <option value="">Tutte le fasi</option>
            <option value="open">Solo aperti</option>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Select aria-label="Punteggio minimo" value={query.minScore ? String(query.minScore) : ""} onChange={(e) => navigate({ minScore: e.target.value ? Number(e.target.value) : undefined })} className="sm:w-52">
            <option value="">Qualsiasi punteggio</option>
            <option value="50">Punteggio 50+</option>
            <option value="75">Punteggio 75+ (caldi)</option>
            <option value="90">Punteggio 90+</option>
          </Select>
          <Select aria-label="Filtra per tag" value={query.tag ?? ""} onChange={(e) => navigate({ tag: e.target.value || undefined })} className="sm:w-44" disabled={!tags.length && !query.tag}>
            <option value="">Tutti i tag</option>
            {query.tag && !tags.includes(query.tag) && <option value={query.tag}>{query.tag}</option>}
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select aria-label="Ordina per" value={query.sort} onChange={(e) => navigate({ sort: e.target.value })} className="sm:w-60">
            {SORT_OPTIONS.map((s) => <option key={s.id} value={s.id}>Ordina: {s.label}</option>)}
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="col-span-2 sm:col-span-1" onClick={() => { setSearch(""); navigate({ q: undefined, stage: undefined, minScore: undefined, tag: undefined }); }}>
              <X className="h-3.5 w-3.5" />Azzera filtri
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between text-[13px] text-ink-3">
          <span aria-live="polite">{total === 1 ? "1 cliente" : `${total} clienti`}{filtersActive && " trovati"}</span>
          <a href={exportHref} className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline" download>Esporta CSV</a>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="Nessun cliente corrisponde ai filtri" description="Prova a cambiare la ricerca o ad azzerare i filtri." />
      ) : (
        <div className={cn("transition-opacity", pending && "opacity-60")}>
          {/* Desktop: tabella */}
          <div className="hidden overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-card md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12px] font-medium text-ink-3">
                  <th className="w-10 py-2.5 pl-4"><Checkbox checked={allChecked} onChange={toggleAll} label="Seleziona tutti" /></th>
                  <th className="py-2.5 pr-3 font-medium">Cliente</th>
                  <th className="w-32 py-2.5 pr-3 font-medium">Fase</th>
                  <th className="w-24 py-2.5 pr-3 font-medium">Punteggio</th>
                  <th className="w-28 py-2.5 pr-3 text-right font-medium">Valore</th>
                  <th className="w-48 py-2.5 pr-3 pl-3 font-medium">Follow-up</th>
                  <th className="hidden w-32 py-2.5 pr-3 font-medium xl:table-cell">Aggiornato</th>
                  <th className="w-24 py-2.5 pr-4"><span className="sr-only">Azioni</span></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}
                    onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,input,label")) router.push(`/app/leads/${l.id}`); }}
                    className={cn("group cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-2/60", sel.has(l.id) && "bg-accent-soft/40")}>
                    <td className="py-3 pl-4"><Checkbox checked={sel.has(l.id)} onChange={() => toggle(l.id)} label={`Seleziona ${l.name}`} /></td>
                    <td className="max-w-0 py-3 pr-3">
                      <Link href={`/app/leads/${l.id}`} className="block truncate font-medium text-ink hover:underline">{l.name}</Link>
                      <div className="truncate text-[12.5px] text-ink-3">{[l.category, l.city].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td className="py-3 pr-3"><StageBadge stage={l.stage} /></td>
                    <td className="py-3 pr-3"><ScoreBadge score={l.score} /></td>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatEuro(l.value)}</td>
                    <td className="py-3 pr-3 pl-3"><FollowUpBadge date={l.nextFollowUp} /></td>
                    <td className="hidden py-3 pr-3 text-[12.5px] text-ink-3 xl:table-cell" suppressHydrationWarning>{relativeTime(l.updatedAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-1">
                        {l.phone && (
                          <a href={telHref(l.phone)} className="rounded-full p-2 text-ink-3 hover:bg-surface hover:text-ink" aria-label={`Chiama ${l.name}`} title={l.phone}>
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <Link href={`/app/leads/${l.id}`} className="rounded-full p-2 text-ink-3 hover:bg-surface hover:text-ink" aria-label={`Apri ${l.name}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card */}
          <div className="md:hidden">
            <div className="mb-2 flex items-center gap-2 px-1 text-[13px] text-ink-2">
              <Checkbox checked={allChecked} onChange={toggleAll} label="Seleziona tutti" />
              <span>Seleziona tutti</span>
            </div>
            <ul className="space-y-2">
              {leads.map((l) => (
                <li key={l.id} className={cn("relative rounded-[var(--radius)] border border-line bg-surface p-3.5 shadow-card", sel.has(l.id) && "border-accent/50 bg-accent-soft/40")}>
                  <div className="flex items-start gap-3">
                    <div className="relative z-10 pt-0.5"><Checkbox checked={sel.has(l.id)} onChange={() => toggle(l.id)} label={`Seleziona ${l.name}`} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/app/leads/${l.id}`} className="min-w-0 font-medium leading-snug after:absolute after:inset-0 after:content-['']">
                          <span className="line-clamp-2">{l.name}</span>
                        </Link>
                        <ScoreBadge score={l.score} className="shrink-0" />
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{[l.category, l.city].filter(Boolean).join(" · ") || "—"}</div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <StageBadge stage={l.stage} />
                        {l.value != null && <span className="text-[12.5px] tabular-nums text-ink-2">{formatEuro(l.value)}</span>}
                        {l.nextFollowUp && <FollowUpBadge date={l.nextFollowUp} />}
                      </div>
                    </div>
                    {l.phone && (
                      <a href={telHref(l.phone)} className="relative z-10 grid h-9 w-9 shrink-0 place-items-center self-center rounded-full border border-line text-ink-2 hover:bg-surface-2" aria-label={`Chiama ${l.name}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {pages > 1 && (
            <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Paginazione">
              <Button variant="outline" size="sm" disabled={query.page <= 1} onClick={() => navigate({ page: query.page - 1 })}><ChevronLeft className="h-4 w-4" />Precedenti</Button>
              <span className="text-[13px] tabular-nums text-ink-2">Pagina {query.page} di {pages}</span>
              <Button variant="outline" size="sm" disabled={query.page >= pages} onClick={() => navigate({ page: query.page + 1 })}>Successivi<ChevronRight className="h-4 w-4" /></Button>
            </nav>
          )}
        </div>
      )}

      {/* Barra azioni di massa */}
      {sel.size > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-2.5 shadow-pop lg:bottom-6 lg:left-[248px] lg:right-0" role="region" aria-label="Azioni sui clienti selezionati">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 text-sm font-medium">{sel.size} selezionat{sel.size === 1 ? "o" : "i"}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Cambia fase</span>
                <ArrowRightLeft className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                <Select value="" disabled={busy !== null} onChange={(e) => { const v = e.target.value; if (v === "lost") setAskLost(true); else if (v) bulkStage(v); }} className="h-8 w-40 rounded-full pl-8 text-[13px]">
                  <option value="">Sposta in…</option>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </label>
              <Button size="sm" variant="outline" onClick={bulkScore} loading={busy === "ai"} disabled={busy !== null}>
                {busy !== "ai" && <Sparkles className="h-3.5 w-3.5 text-accent" />}Valuta con AI
              </Button>
              <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                <Trash2 className="h-3.5 w-3.5" />Elimina
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(new Set())} aria-label="Annulla selezione"><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={sel.size === 1 ? "Eliminare il cliente?" : `Eliminare ${sel.size} clienti?`}>
        <p className="text-sm text-ink-2">Verranno eliminati anche note, attività e briefing collegati. L&apos;operazione non si può annullare.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annulla</Button>
          <Button variant="danger" onClick={bulkDelete} loading={busy === "delete"}>Elimina definitivamente</Button>
        </div>
      </Dialog>
      <LostReasonDialog open={askLost} onCancel={() => setAskLost(false)} onConfirm={(r) => { setAskLost(false); bulkStage("lost", r); }} />
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input type="checkbox" checked={checked} onChange={onChange} aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-line-strong accent-[var(--accent)]" />
  );
}
