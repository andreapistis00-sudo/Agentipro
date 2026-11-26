"use client";
import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, ChevronDown, Globe, History, Info, MapPinned, Phone, RotateCcw, SearchX, Sparkles, X,
} from "lucide-react";
import { Badge, Button, EmptyState, Select, useToast } from "@/components/ui";
import type { ImportResponse, RecentSearch, SearchResponse, SearchResultWithStatus } from "@/lib/search/types";
import { cn, relativeTime } from "@/lib/utils";
import { RadarMap, formatKm, resultKey } from "./radar-map";
import { ResultCard, ResultSkeleton } from "./result-card";
import { RADIUS_STOPS, SearchForm, type FormValues } from "./search-form";

type Sort = "distance" | "name" | "rating";
type Status = "idle" | "loading" | "error" | "done";

const PROVIDER_LABEL: Record<SearchResponse["provider"], string> = {
  osm: "OpenStreetMap",
  google: "Google Places",
  demo: "Dati demo",
};

function isCoords(s: string) {
  return /^\s*-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?\s*$/.test(s);
}

export function SearchView({
  initialRecent,
  defaultLocation,
  initialQuery,
}: {
  initialRecent: RecentSearch[];
  defaultLocation: string;
  initialQuery: { q?: string; l?: string; r?: number } | null;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState<FormValues>({
    query: initialQuery?.q ?? "",
    location: initialQuery?.l ?? defaultLocation,
    radiusKm: initialQuery?.r ?? 5,
    geoLabel: initialQuery?.l && isCoords(initialQuery.l) ? "La tua posizione" : null,
  });
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [results, setResults] = React.useState<SearchResultWithStatus[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState(initialRecent);
  const [saving, setSaving] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(true);

  const [text, setText] = React.useState("");
  const [phoneOnly, setPhoneOnly] = React.useState(false);
  const [siteOnly, setSiteOnly] = React.useState(false);
  const [sort, setSort] = React.useState<Sort>("distance");

  const abortRef = React.useRef<AbortController | null>(null);

  const refreshRecent = React.useCallback(async () => {
    const res = await fetch("/api/search").catch(() => null);
    if (res?.ok) setRecent(((await res.json()) as { searches: RecentSearch[] }).searches);
  }, []);

  const runSearch = React.useCallback(async (v: FormValues) => {
    const query = v.query.trim();
    const location = v.location.trim();
    if (query.length < 2) return toast("Scrivi cosa cerchi (almeno 2 caratteri)", "error");
    if (location.length < 2) return toast("Indica dove cercare: città, indirizzo o CAP", "error");

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setError(null);
    setSelected(new Set());
    setHovered(null);
    setText("");

    const params = new URLSearchParams({ q: query, l: location, r: String(v.radiusKm) });
    window.history.replaceState(null, "", `?${params}`);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, radiusKm: v.radiusKm }),
        signal: ctrl.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "La ricerca non è riuscita");
      const body = json as SearchResponse;
      setData(body);
      setResults(body.results);
      setStatus("done");
      void refreshRecent();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "La ricerca non è riuscita");
      setStatus("error");
    }
  }, [refreshRecent, toast]);

  // Ricerca automatica se la pagina è aperta con ?q=&l=
  const autoRan = React.useRef(false);
  React.useEffect(() => {
    if (autoRan.current || !initialQuery?.q || !initialQuery.l) return;
    autoRan.current = true;
    void runSearch({ query: initialQuery.q, location: initialQuery.l, radiusKm: initialQuery.r ?? 5, geoLabel: null });
  }, [initialQuery, runSearch]);

  /* ---------- Filtri e ordinamento ---------- */
  const visible = React.useMemo(() => {
    const t = text.trim().toLowerCase();
    const list = results.filter((r) =>
      (!phoneOnly || r.phone) &&
      (!siteOnly || r.website) &&
      (!t || [r.name, r.category, r.address].some((f) => f?.toLowerCase().includes(t))),
    );
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "it"));
    else if (sort === "rating") sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
    else sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    return sorted;
  }, [results, text, phoneOnly, siteOnly, sort]);

  const selectable = visible.filter((r) => !r.alreadySaved);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(resultKey(r)));
  const savedCount = results.filter((r) => r.alreadySaved).length;
  const withPhone = results.filter((r) => r.phone).length;
  const withSite = results.filter((r) => r.website).length;
  const hasRatings = results.some((r) => r.rating != null);
  const filtersActive = Boolean(text.trim()) || phoneOnly || siteOnly;

  const toggle = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((r) => next.delete(resultKey(r)));
      else selectable.forEach((r) => next.add(resultKey(r)));
      return next;
    });
  }

  /* ---------- Salvataggio nel CRM ---------- */
  async function save(items: SearchResultWithStatus[]) {
    if (!items.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Salvataggio non riuscito");
      const body = json as ImportResponse;
      const ids = new Map(body.leads.map((l) => [l.sourceId, l.id]));
      const keys = new Set(items.map(resultKey));
      setResults((prev) => prev.map((r) => (keys.has(resultKey(r)) && ids.has(r.sourceId) ? { ...r, alreadySaved: true, leadId: ids.get(r.sourceId)! } : r)));
      setSelected((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
      const msg = body.created === 1 ? "1 attività salvata nel CRM" : `${body.created} attività salvate nel CRM`;
      toast(body.created ? (body.skipped ? `${msg} · ${body.skipped} già presenti` : msg) : "Erano già tutte nel CRM", body.created ? "success" : "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Salvataggio non riuscito", "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = results.filter((r) => selected.has(resultKey(r)) && !r.alreadySaved);

  function pickFromMap(key: string) {
    const r = results.find((x) => resultKey(x) === key);
    if (!r) return;
    const el = document.getElementById(`res-${r.source}-${r.sourceId}`.replace(/[^a-zA-Z0-9_-]/g, "_"));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!r.alreadySaved) toggle(key);
  }

  function resetFilters() {
    setText("");
    setPhoneOnly(false);
    setSiteOnly(false);
  }

  const loading = status === "loading";
  const center = data?.center ?? null;
  const shownRadius = data?.radiusKm ?? form.radiusKm;
  const nextRadius = RADIUS_STOPS.find((s) => s > (data?.radiusKm ?? 0));

  /* ---------- Render ---------- */
  return (
    <div>
      <SearchForm values={form} onChange={setForm} onSubmit={runSearch} loading={loading} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Colonna mappa (sopra su mobile) */}
        <aside className={cn("lg:order-2", status === "idle" && "hidden lg:block")}>
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-card">
              <button type="button" onClick={() => setMapOpen((o) => !o)} aria-expanded={mapOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:pointer-events-none">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Mappa</div>
                  <div className="truncate text-sm font-medium">
                    {center ? <>Entro {formatKm(shownRadius)} da {center.label}</> : "Il raggio della tua ricerca"}
                  </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform lg:hidden", mapOpen && "rotate-180")} aria-hidden />
              </button>
              <div className={cn("border-t border-line", !mapOpen && "hidden lg:block")}>
                <RadarMap
                  center={center}
                  radiusKm={shownRadius}
                  results={loading ? [] : visible}
                  selected={selected}
                  hovered={hovered}
                  onHover={setHovered}
                  onPick={pickFromMap}
                  loading={loading}
                  className="mx-auto aspect-square w-full max-w-[280px] p-3 sm:max-w-[340px] lg:max-w-none"
                />
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
                  <Legend color="var(--ink-2)" label="Trovate" />
                  <Legend color="var(--accent)" label="Selezionate" />
                  <Legend color="var(--success)" label="Nel CRM" />
                </div>
              </div>
            </div>

            {recent.length > 0 && (
              <RecentList recent={recent} disabled={loading} className="hidden lg:block"
                onPick={(s) => {
                  const v = { query: s.query, location: s.location, radiusKm: s.radiusKm, geoLabel: isCoords(s.location) ? "La tua posizione" : null };
                  setForm(v);
                  void runSearch(v);
                }} />
            )}
          </div>
        </aside>

        {/* Colonna risultati */}
        <section className="min-w-0 lg:order-1" aria-live="polite" aria-busy={loading}>
          {status === "idle" && (
            <IntroState recent={recent} onPick={(s) => {
              const v = { query: s.query, location: s.location, radiusKm: s.radiusKm, geoLabel: isCoords(s.location) ? "La tua posizione" : null };
              setForm(v);
              void runSearch(v);
            }} />
          )}

          {loading && (
            <div>
              <div className="mb-4 flex items-center gap-3"><div className="skeleton h-5 w-56" /></div>
              <ul className="space-y-3">{Array.from({ length: 6 }, (_, i) => <ResultSkeleton key={i} />)}</ul>
            </div>
          )}

          {status === "error" && (
            <div role="alert" className="flex items-start gap-3 rounded-[var(--radius)] border border-danger/30 bg-danger-soft p-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <div className="flex-1">
                <p className="font-medium text-ink">Ricerca non riuscita</p>
                <p className="mt-0.5 text-ink-2">{error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => runSearch(form)}><RotateCcw className="h-3.5 w-3.5" />Riprova</Button>
            </div>
          )}

          {status === "done" && data && (
            <>
              {/* Intestazione risultati */}
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold leading-tight">
                    {results.length === 0 ? "Nessuna attività" : results.length === 1 ? "1 attività" : `${results.length} attività`}
                    <span className="font-normal text-ink-2"> · {data.query} entro {formatKm(data.radiusKm)} da {data.center.label}</span>
                  </h2>
                  {results.length > 0 && (
                    <p className="mt-1 text-[13px] text-ink-3">
                      {withPhone} con telefono · {withSite} con sito{savedCount > 0 && <> · <span className="text-success">{savedCount} già nel CRM</span></>}
                    </p>
                  )}
                </div>
                <Badge tone={data.demo ? "warn" : "neutral"} title={`Fonte: ${PROVIDER_LABEL[data.provider]}`}>
                  {data.demo ? <Sparkles className="h-3 w-3" aria-hidden /> : <MapPinned className="h-3 w-3" aria-hidden />}
                  {PROVIDER_LABEL[data.provider]}
                </Badge>
              </div>

              {data.notice && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft/60 px-3.5 py-2.5 text-[13px] text-ink-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                  <span>{data.notice}</span>
                </div>
              )}

              {results.length === 0 ? (
                <EmptyState
                  icon={<SearchX className="h-5 w-5" />}
                  title="Nessuna attività in questa zona"
                  description="Prova ad allargare il raggio, a usare un sinonimo (es. «trattorie» invece di «ristoranti») o a cercare per nome."
                  action={nextRadius ? (
                    <Button variant="outline" onClick={() => { const v = { ...form, radiusKm: nextRadius }; setForm(v); void runSearch(v); }}>
                      Allarga a {formatKm(nextRadius)}
                    </Button>
                  ) : undefined}
                />
              ) : (
                <>
                  {/* Filtri */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-line bg-surface/70 p-2">
                    <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full pl-2 pr-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0}
                        className="h-4 w-4 cursor-pointer accent-accent" />
                      Seleziona tutti{selectable.length > 0 && <span className="font-mono text-[12px] text-ink-3">{selectable.length}</span>}
                    </label>
                    <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
                    <FilterChip active={phoneOnly} onClick={() => setPhoneOnly((v) => !v)} icon={<Phone className="h-3.5 w-3.5" />}>Con telefono</FilterChip>
                    <FilterChip active={siteOnly} onClick={() => setSiteOnly((v) => !v)} icon={<Globe className="h-3.5 w-3.5" />}>Con sito</FilterChip>
                    <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
                      <div className="relative min-w-0 flex-1">
                        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filtra per nome o via"
                          aria-label="Filtra i risultati"
                          className="h-9 w-full rounded-full border border-line bg-surface pl-3.5 pr-8 text-[13px] text-ink placeholder:text-ink-3 focus:border-ink/40 focus:outline-none" />
                        {text && (
                          <button type="button" onClick={() => setText("")} aria-label="Cancella filtro"
                            className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordina per"
                        className="h-9 w-auto shrink-0 rounded-full pl-3.5 pr-8 text-[13px]">
                        <option value="distance">Più vicini</option>
                        <option value="name">Nome A–Z</option>
                        {hasRatings && <option value="rating">Valutazione</option>}
                      </Select>
                    </div>
                  </div>

                  {visible.length === 0 ? (
                    <EmptyState icon={<SearchX className="h-5 w-5" />} title="Nessun risultato con questi filtri"
                      description="Rimuovi qualche filtro per vedere tutte le attività trovate."
                      action={<Button variant="outline" onClick={resetFilters}>Rimuovi filtri</Button>} />
                  ) : (
                    <>
                      {filtersActive && (
                        <p className="mb-2 px-1 text-[12.5px] text-ink-3">
                          {visible.length} di {results.length} ·{" "}
                          <button type="button" onClick={resetFilters} className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">rimuovi filtri</button>
                        </p>
                      )}
                      <ul className="space-y-3">
                        {visible.map((r) => {
                          const key = resultKey(r);
                          return (
                            <ResultCard key={key} result={r} selected={selected.has(key)} hovered={hovered === key}
                              onToggle={() => toggle(key)} onHover={(on) => setHovered(on ? key : null)}
                              onSaveOne={() => save([r])} saving={saving} />
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {recent.length > 0 && status !== "idle" && (
            <RecentList recent={recent} disabled={loading} className="mt-8 lg:hidden"
              onPick={(s) => {
                const v = { query: s.query, location: s.location, radiusKm: s.radiusKm, geoLabel: isCoords(s.location) ? "La tua posizione" : null };
                setForm(v);
                window.scrollTo({ top: 0, behavior: "smooth" });
                void runSearch(v);
              }} />
          )}
        </section>
      </div>

      {/* Barra azioni */}
      <div className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 transition-all duration-200 lg:bottom-6 lg:left-[248px]",
        selectedItems.length > 0 ? "translate-y-0 opacity-100 [&>div]:pointer-events-auto" : "translate-y-4 opacity-0",
      )}>
        <div className="flex w-full max-w-xl items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-4 shadow-pop sm:gap-3">
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold tabular-nums">{selectedItems.length}</span>{" "}
            <span className="text-ink-2">{selectedItems.length === 1 ? "selezionata" : "selezionate"}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={saving}>Annulla</Button>
          <Button variant="secondary" onClick={() => save(selectedItems)} loading={saving} tabIndex={selectedItems.length ? 0 : -1}>
            Salva {selectedItems.length} nel CRM
          </Button>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function FilterChip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
        active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}>
      {icon}
      {children}
    </button>
  );
}

function RecentList({ recent, onPick, disabled, className }: {
  recent: RecentSearch[]; onPick: (s: RecentSearch) => void; disabled?: boolean; className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius)] border border-line bg-surface shadow-card", className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <History className="h-4 w-4 text-ink-3" aria-hidden />
        <h2 className="text-sm font-semibold">Ricerche recenti</h2>
      </div>
      <ul className="divide-y divide-line">
        {recent.slice(0, 6).map((s) => (
          <li key={s.id}>
            <button type="button" disabled={disabled} onClick={() => onPick(s)}
              className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.query}</div>
                <div className="truncate text-[12px] text-ink-3">
                  {isCoords(s.location) ? "La tua posizione" : s.location} · {formatKm(s.radiusKm)} · {s.results} risultati · {relativeTime(s.createdAt)}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntroState({ recent, onPick }: { recent: RecentSearch[]; onPick: (s: RecentSearch) => void }) {
  const steps = [
    { n: "1", title: "Cosa e dove", text: "Scrivi il tipo di attività e la zona: città, via o CAP. Oppure usa la tua posizione." },
    { n: "2", title: "Scegli i migliori", text: "Filtra chi ha telefono o sito, guarda la distanza e seleziona i potenziali clienti." },
    { n: "3", title: "Salva nel CRM", text: "Con un clic diventano lead nella colonna «Nuovo» della pipeline, pronti da contattare." },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-5 sm:p-7">
        <h2 className="font-display text-[26px] leading-tight tracking-tight">Il tuo prossimo cliente è a pochi isolati.</h2>
        <p className="mt-2 max-w-lg text-sm text-ink-2">Cerca tra le attività reali della tua zona e portale nel CRM senza copiare nulla a mano.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[13px] font-semibold text-accent">{s.n}</span>
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {recent.length > 0 && <RecentList recent={recent} onPick={onPick} className="lg:hidden" />}
      <p className="px-1 text-[12.5px] text-ink-3">
        Suggerimento: per un lavoro di zona imposta il territorio nel <Link href="/app/settings" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">profilo</Link>, lo useremo come luogo predefinito.
      </p>
    </div>
  );
}
