import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STAGES = [
  { id: "new", label: "Nuovo", color: "var(--stage-new)" },
  { id: "contacted", label: "Contattato", color: "var(--stage-contacted)" },
  { id: "qualified", label: "Qualificato", color: "var(--stage-qualified)" },
  { id: "negotiation", label: "Trattativa", color: "var(--stage-negotiation)" },
  { id: "won", label: "Vinto", color: "var(--stage-won)" },
  { id: "lost", label: "Perso", color: "var(--stage-lost)" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];
export const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;

export const ACTIVITY_TYPES = [
  { id: "note", label: "Nota" },
  { id: "call", label: "Chiamata" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Visita" },
  { id: "task", label: "Promemoria" },
] as const;

export function formatEuro(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", opts).format(new Date(d));
}

export function relativeTime(d: Date | string) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Colore del punteggio lead. */
export function scoreTone(score: number | null | undefined) {
  if (score == null) return "muted";
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}
