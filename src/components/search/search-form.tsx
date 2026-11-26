"use client";
import * as React from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatKm } from "./radar-map";

export const RADIUS_STOPS = [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50];
export const QUICK_CATEGORIES = [
  "Bar", "Ristoranti", "Pizzerie", "Parrucchieri", "Centri estetici", "Studi dentistici",
  "Farmacie", "Ferramenta", "Panifici", "Officine", "Hotel",
];

export type FormValues = { query: string; location: string; radiusKm: number; geoLabel: string | null };

const nearestStop = (km: number) =>
  RADIUS_STOPS.reduce((best, s, i) => (Math.abs(s - km) < Math.abs(RADIUS_STOPS[best] - km) ? i : best), 0);

export function SearchForm({
  values,
  onChange,
  onSubmit,
  loading,
}: {
  values: FormValues;
  onChange: (v: FormValues) => void;
  onSubmit: (v: FormValues) => void;
  loading: boolean;
}) {
  const toast = useToast();
  const [locating, setLocating] = React.useState(false);
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch });

  function locate() {
    if (!("geolocation" in navigator)) return toast("Il tuo browser non supporta la geolocalizzazione", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        set({ location: `${latitude.toFixed(5)},${longitude.toFixed(5)}`, geoLabel: "La tua posizione" });
      },
      (err) => {
        setLocating(false);
        toast(err.code === err.PERMISSION_DENIED ? "Permesso di posizione negato: scrivi la città o il CAP" : "Non riusciamo a rilevare la tua posizione", "error");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const stopIndex = nearestStop(values.radiusKm);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}
      className="rounded-[calc(var(--radius)+6px)] border border-line bg-surface p-3 shadow-card sm:p-4"
      role="search"
      aria-label="Cerca attività"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,220px)_auto] lg:items-end">
        {/* Cosa */}
        <div>
          <label htmlFor="q" className="mb-1.5 block px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Cosa cerchi</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input id="q" value={values.query} onChange={(e) => set({ query: e.target.value })} required minLength={2} maxLength={80}
              placeholder="Bar, parrucchieri, ferramenta…" autoComplete="off"
              className="h-12 w-full rounded-xl border border-line bg-bg/60 pl-10 pr-3 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-ink/40 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-ink/5" />
          </div>
        </div>

        {/* Dove */}
        <div>
          <label htmlFor="l" className="mb-1.5 block px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Dove</label>
          <div className="relative">
            <MapPin className={cn("pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", values.geoLabel ? "text-accent" : "text-ink-3")} aria-hidden />
            <input id="l" value={values.geoLabel ?? values.location} required minLength={2} maxLength={120}
              onChange={(e) => set({ location: e.target.value, geoLabel: null })}
              readOnly={Boolean(values.geoLabel)}
              placeholder="Città, indirizzo o CAP" autoComplete="address-level2"
              className={cn("h-12 w-full rounded-xl border border-line bg-bg/60 pl-10 pr-12 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-ink/40 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-ink/5",
                values.geoLabel && "font-medium")} />
            {values.geoLabel ? (
              <button type="button" onClick={() => set({ location: "", geoLabel: null })} aria-label="Rimuovi la posizione"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={locate} disabled={locating} aria-label="Usa la mia posizione" title="Usa la mia posizione"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-accent disabled:opacity-50">
                <LocateFixed className={cn("h-4 w-4", locating && "animate-pulse text-accent")} />
              </button>
            )}
          </div>
        </div>

        {/* Raggio */}
        <div className="md:col-span-2 lg:col-span-1">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <label htmlFor="r" className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Raggio</label>
            <span className="font-mono text-[13px] font-medium tabular-nums text-ink">{formatKm(values.radiusKm)}</span>
          </div>
          <div className="flex h-12 items-center rounded-xl border border-line bg-bg/60 px-3.5">
            <input id="r" type="range" min={0} max={RADIUS_STOPS.length - 1} step={1} value={stopIndex}
              onChange={(e) => set({ radiusKm: RADIUS_STOPS[Number(e.target.value)] })}
              aria-valuetext={formatKm(values.radiusKm)}
              className="h-1.5 w-full cursor-pointer accent-accent" />
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading} className="h-12 w-full md:col-span-2 lg:col-span-1 lg:w-auto lg:px-7">
          {!loading && <Search className="h-4 w-4" aria-hidden />}
          Cerca
        </Button>
      </div>

      {/* Suggerimenti rapidi */}
      <div className="-mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] sm:-mx-4 sm:flex-wrap sm:px-4 [&::-webkit-scrollbar]:hidden">
        {QUICK_CATEGORIES.map((c) => {
          const active = values.query.trim().toLowerCase() === c.toLowerCase();
          return (
            <button key={c} type="button"
              onClick={() => {
                const next = { ...values, query: c };
                onChange(next);
                if (next.location.trim().length >= 2) onSubmit(next);
              }}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition",
                active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              )}>
              {c}
            </button>
          );
        })}
      </div>
    </form>
  );
}
