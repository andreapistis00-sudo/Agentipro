"use client";
import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clock, Globe, MapPin, Phone, Plus, Star } from "lucide-react";
import type { SearchResultWithStatus } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { formatKm } from "./radar-map";

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const ResultCard = React.memo(function ResultCard({
  result,
  selected,
  hovered,
  onToggle,
  onHover,
  onSaveOne,
  saving,
}: {
  result: SearchResultWithStatus;
  selected: boolean;
  hovered: boolean;
  onToggle: () => void;
  onHover: (on: boolean) => void;
  onSaveOne: () => void;
  saving: boolean;
}) {
  const r = result;
  const id = `res-${r.source}-${r.sourceId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <li
      id={id}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={() => !r.alreadySaved && onToggle()}
      className={cn(
        "group relative flex gap-3 rounded-[var(--radius)] border bg-surface p-4 shadow-card transition-[border-color,box-shadow,background] sm:gap-4",
        r.alreadySaved ? "border-line" : "cursor-pointer",
        selected ? "border-accent/70 bg-accent-soft/40 ring-1 ring-accent/30" : hovered ? "border-line-strong shadow-pop" : "border-line",
      )}
    >
      {/* Selezione */}
      <div className="pt-0.5">
        {r.alreadySaved ? (
          <span className="grid h-5 w-5 place-items-center rounded-md bg-success-soft text-success" title="Già nel CRM">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={stop}
            aria-label={`Seleziona ${r.name}`}
            className="h-5 w-5 cursor-pointer rounded-md accent-accent"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-snug">{r.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
              {r.category && <span>{r.category}</span>}
              {r.rating != null && (
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <Star className="h-3.5 w-3.5 fill-warm text-warm" aria-hidden />
                  <span className="font-medium text-ink">{r.rating.toFixed(1).replace(".", ",")}</span>
                  {r.reviewsCount != null && <span className="text-ink-3">({r.reviewsCount})</span>}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[12px] tabular-nums text-ink-2">{formatKm(r.distanceKm)}</span>
        </div>

        {r.address && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0">{r.address}</span>
          </p>
        )}
        {r.openingHours && (
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-ink-3">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1 min-w-0">{r.openingHours}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.phone && (
            <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} onClick={stop}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-line-strong hover:bg-surface-2">
              <Phone className="h-3.5 w-3.5 text-ink-3" aria-hidden />
              {r.phone}
            </a>
          )}
          {r.website && (
            <a href={r.website} target="_blank" rel="noopener noreferrer" onClick={stop}
              className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-line-strong hover:bg-surface-2">
              <Globe className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">{hostname(r.website)}</span>
            </a>
          )}
          {!r.phone && !r.website && <span className="text-[12.5px] text-ink-3">Nessun contatto pubblicato</span>}

          <div className="ml-auto">
            {r.alreadySaved && r.leadId ? (
              <Link href={`/app/leads/${r.leadId}`} onClick={stop}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-success-soft px-3 text-[13px] font-medium text-success hover:brightness-95">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Già nel CRM
              </Link>
            ) : (
              <button type="button" disabled={saving}
                onClick={(e) => { stop(e); onSaveOne(); }}
                className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-2 opacity-100 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Salva
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

export function ResultSkeleton() {
  return (
    <li className="flex gap-4 rounded-[var(--radius)] border border-line bg-surface p-4" aria-hidden>
      <div className="skeleton h-5 w-5 rounded-md" />
      <div className="flex-1 space-y-2.5">
        <div className="flex justify-between gap-4"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-4 w-12" /></div>
        <div className="skeleton h-3 w-1/4" />
        <div className="skeleton h-3 w-2/3" />
        <div className="flex gap-2 pt-1"><div className="skeleton h-8 w-32 rounded-full" /><div className="skeleton h-8 w-28 rounded-full" /></div>
      </div>
    </li>
  );
}
