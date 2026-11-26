// Costruzione del contesto testuale di un lead per i prompt (e per le euristiche demo).
import type { Activity, Lead, User } from "@prisma/client";
import { stageLabel } from "@/lib/utils";

export type SellerProfile = Pick<User, "name" | "company" | "sector" | "products" | "idealCustomer" | "territory" | "tone">;
export type LeadForAi = Omit<Lead, "userId" | "position" | "briefing" | "briefingAt" | "scoreReason" | "scoredAt" | "sourceId"> &
  Partial<Pick<Lead, "briefing" | "briefingAt" | "scoreReason" | "scoredAt">>;
export type ActivityForAi = Pick<Activity, "type" | "content" | "dueAt" | "done" | "createdAt">;

const ACTIVITY_LABEL: Record<string, string> = {
  note: "Nota", call: "Chiamata", email: "Email", meeting: "Visita", task: "Promemoria", stage: "Cambio fase",
};

const fmt = (d: Date | string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

/** Normalizza per confronti testuali (minuscolo, senza accenti). */
export function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Il lead è nel territorio dell'agente? true/false se deducibile dai testi, null se non si può dire.
 * Confronta la città (o l'indirizzo) del lead con le parole significative del territorio.
 */
export function inTerritory(lead: Pick<Lead, "city" | "address">, territory: string | null | undefined): boolean | null {
  const t = norm(territory);
  const place = norm([lead.city, lead.address].filter(Boolean).join(" "));
  if (!t || !place) return null;
  const stop = new Set(["e", "provincia", "prov", "di", "del", "della", "zona", "area", "citta", "hinterland", "dintorni", "comuni", "limitrofi", "tutta", "intera", "nord", "sud", "est", "ovest", "centro"]);
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w));
  if (!words.length) return null;
  return words.some((w) => place.includes(w));
}

/** Scheda testuale del lead per i prompt. */
export function leadToText(lead: LeadForAi, activities: ActivityForAi[] = []) {
  const lines = [
    `Nome: ${lead.name}`,
    lead.category && `Categoria: ${lead.category}`,
    (lead.address || lead.city) && `Indirizzo: ${[lead.address, lead.city].filter(Boolean).join(", ")}`,
    lead.phone && `Telefono: ${lead.phone}`,
    lead.email && `Email: ${lead.email}`,
    lead.website && `Sito web: ${lead.website}`,
    lead.openingHours && `Orari: ${lead.openingHours}`,
    lead.rating != null && `Valutazione: ${lead.rating}/5${lead.reviewsCount != null ? ` su ${lead.reviewsCount} recensioni` : ""}`,
    `Fase CRM: ${stageLabel(lead.stage)}`,
    lead.value != null && `Valore potenziale stimato: ${lead.value} €`,
    lead.contactName && `Referente: ${lead.contactName}${lead.contactRole ? ` (${lead.contactRole})` : ""}`,
    lead.tags && `Tag: ${lead.tags}`,
    lead.nextFollowUp && `Prossimo follow-up: ${fmt(lead.nextFollowUp)}`,
    lead.lostReason && `Motivo perdita: ${lead.lostReason}`,
    lead.score != null && `Punteggio AI attuale: ${lead.score}/100`,
    lead.notes && `Note dell'agente: ${lead.notes}`,
    `Inserito nel CRM: ${fmt(lead.createdAt)} (fonte: ${lead.source})`,
  ].filter(Boolean) as string[];
  if (activities.length) {
    lines.push("", "Storico attività (dalla più recente):");
    for (const a of activities.slice(0, 15)) {
      const due = a.dueAt ? ` — scadenza ${fmt(a.dueAt)}${a.done ? " (fatto)" : ""}` : "";
      lines.push(`- ${fmt(a.createdAt)} · ${ACTIVITY_LABEL[a.type] ?? a.type}: ${a.content.slice(0, 400)}${due}`);
    }
  } else {
    lines.push("", "Storico attività: nessuna attività registrata.");
  }
  return lines.join("\n");
}

/** Data odierna leggibile (fuso italiano). */
export function todayIt(now = new Date()) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
}
