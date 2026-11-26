// Schemi e tipi condivisi delle funzioni AI. Sicuri sia lato server sia lato client (niente import server).
import { z } from "zod";
import { ConfidenceSchema, type ScoreBreakdown } from "./scoring";

/* ---------------------------------- Lead score ---------------------------------- */

export const ScoreFactorSchema = z.object({
  label: z.string().describe("Etichetta breve del fattore, max 4 parole (es. 'Recensioni ottime')"),
  impact: z.enum(["+", "-"]).describe("'+' se aumenta il punteggio, '-' se lo riduce"),
  detail: z.string().describe("Descrizione oggettiva in una frase, citando il dato. Niente consigli su cosa fare."),
});

const dim = (what: string) =>
  z
    .object({
      score: z.number().describe("Sotto-punteggio intero da 0 a 100"),
      reason: z.string().describe("Motivazione in una frase, descrittiva, che cita il dato usato (o dice che manca)"),
    })
    .describe(what);

/** Output strutturato richiesto al modello per ogni lead. Il totale lo calcola il codice con i pesi dell'agente. */
export const ScoreOutputSchema = z.object({
  dimensions: z.object({
    fit: dim("Aderenza al cliente ideale dell'agente, a ciò che vende e ai suoi criteri di valutazione"),
    size: dim("Dimensione e volume d'attività stimati (recensioni, sedi, coperti, dipendenti, orari)"),
    reputation: dim("Reputazione: valutazione e numero di recensioni, giudizi pubblici"),
    presence: dim("Presenza online e reperibilità: sito, social, schede, telefono, email, referente"),
    proximity: dim("Vicinanza al territorio di lavoro dichiarato dall'agente"),
    data: dim("Completezza dei dati disponibili sul cliente (scheda CRM e ricerca)"),
  }),
  confidence: ConfidenceSchema.describe("Affidabilità della valutazione in base alla quantità e qualità dei dati"),
  summary: z.string().describe("Sintesi neutra in una frase di com'è il cliente rispetto ai criteri, senza consigli"),
  factors: z.array(ScoreFactorSchema).describe("Da 3 a 5 fattori, positivi e negativi"),
});
export type ScoreOutput = z.infer<typeof ScoreOutputSchema>;
export type ScoreFactor = z.infer<typeof ScoreFactorSchema>;

/** Contenuto di `Lead.scoreReason`. */
export const ScoreReasonSchema = z.object({
  summary: z.string(),
  factors: z.array(ScoreFactorSchema),
  demo: z.boolean().optional(),
});
export type ScoreReason = z.infer<typeof ScoreReasonSchema>;

export function parseScoreReason(raw: string | null | undefined): ScoreReason | null {
  if (!raw) return null;
  try {
    const parsed = ScoreReasonSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    // Compatibilità: testo libero salvato da versioni precedenti.
    return { summary: raw, factors: [] };
  }
}

export const ScoreRequestSchema = z.object({
  leadIds: z.array(z.string().min(1).max(64)).min(1, "Seleziona almeno un cliente").max(50, "Puoi valutare al massimo 50 clienti alla volta"),
});

export type ScoreResult = { leadId: string; score: number; summary: string; breakdown: ScoreBreakdown };
export type ScoreResponse = { results: ScoreResult[]; errors?: { leadId: string; error: string }[]; demo: boolean };

/* ---------------------------------- Scheda AI (ricerca sul cliente) ---------------------------------- */

export const SourceSchema = z.object({ title: z.string(), url: z.string() });
export type Source = z.infer<typeof SourceSchema>;

const txt = (d: string) => z.string().describe(`${d}. Stringa vuota se non trovato`);

/**
 * Struttura richiesta al modello (output_config.format). Testi vuoti = informazione non trovata:
 * il server li converte in null. Le fonti vengono aggiunte dal server.
 */
export const ResearchOutputSchema = z.object({
  summary: z.string().describe("Chi è l'attività in 2-3 frasi neutre e fattuali"),
  business: z.object({
    type: txt("Tipo di attività (es. 'Pasticceria artigianale con laboratorio')"),
    offering: txt("Cosa fa, vende o offre: prodotti, servizi, specialità"),
    openingHours: txt("Orari di apertura"),
    priceLevel: txt("Fascia di prezzo, solo se indicata da una fonte"),
    foundedOrSince: txt("Anno di fondazione o da quando è attiva"),
    size: txt("Dimensione nota: coperti, dipendenti, punti vendita, metri quadri"),
    locations: z.array(z.string()).describe("Sedi o punti vendita noti (indirizzi)"),
  }),
  people: z
    .array(z.object({ name: z.string(), role: txt("Ruolo (titolare, socio, chef, direttore…)"), source: txt("URL o nome della fonte") }))
    .describe("Titolari e referenti citati pubblicamente. Vuoto se non trovati: mai inventare nomi"),
  online: z.object({
    website: txt("Sito ufficiale (URL)"),
    phone: txt("Telefono pubblico"),
    email: txt("Email pubblica"),
    socials: z.array(z.object({ platform: z.string(), url: z.string() })).describe("Profili social ufficiali trovati"),
    googleRating: z.number().nullable().describe("Valutazione media su Google (1-5) se nota, altrimenti null"),
    reviewsCount: z.number().nullable().describe("Numero di recensioni su Google se noto, altrimenti null"),
    otherListings: z
      .array(z.object({ name: z.string().describe("Es. TripAdvisor, TheFork, PagineGialle"), url: txt("URL della scheda"), detail: txt("Dato saliente, es. '4,5/5 su 210 recensioni'") }))
      .describe("Altre schede e directory in cui compare"),
  }),
  reputation: z.object({
    overall: txt("Sintesi neutra di cosa emerge dalle recensioni pubbliche"),
    positives: z.array(z.string()).describe("Aspetti apprezzati ricorrenti nelle recensioni"),
    negatives: z.array(z.string()).describe("Critiche ricorrenti nelle recensioni"),
  }),
  facts: z
    .array(z.object({ text: z.string(), sourceUrl: txt("URL della fonte") }))
    .describe("Fatti verificabili: notizie, eventi, premi, aperture, ristrutturazioni, cambi di gestione"),
  signals: z
    .array(z.object({ label: z.string().describe("Etichetta breve, max 5 parole"), detail: z.string().describe("Descrizione oggettiva, senza dire cosa fare") }))
    .describe("Elementi oggettivi utili a capire il cliente (es. 'Aperto 7 giorni su 7', 'Seconda sede da marzo 2025')"),
  unknowns: z.array(z.string()).describe("Cose che non è stato possibile verificare"),
  confidence: ConfidenceSchema.describe("Affidabilità complessiva: alta se più fonti concordano sull'attività, bassa se poco o nulla è stato trovato"),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

const opt = z.string().nullable().default(null);
const optUrl = z.string().nullable().default(null);

/** Contenuto di `Lead.briefing` (Scheda AI, formato v2). */
export const ResearchSchema = z.object({
  v: z.literal(2),
  summary: z.string(),
  business: z.object({
    type: opt, offering: opt, openingHours: opt, priceLevel: opt, foundedOrSince: opt, size: opt,
    locations: z.array(z.string()).default([]),
  }),
  people: z.array(z.object({ name: z.string(), role: opt, source: opt })).default([]),
  online: z.object({
    website: optUrl, phone: opt, email: opt,
    socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    googleRating: z.number().nullable().default(null),
    reviewsCount: z.number().nullable().default(null),
    otherListings: z.array(z.object({ name: z.string(), url: optUrl, detail: opt })).default([]),
  }),
  reputation: z.object({ overall: opt, positives: z.array(z.string()).default([]), negatives: z.array(z.string()).default([]) }),
  facts: z.array(z.object({ text: z.string(), sourceUrl: optUrl })).default([]),
  signals: z.array(z.object({ label: z.string(), detail: z.string() })).default([]),
  unknowns: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
  sources: z.array(SourceSchema).default([]),
  demo: z.boolean().optional(),
});
export type Research = z.infer<typeof ResearchSchema>;

export type ParsedResearch = { kind: "ok"; research: Research } | { kind: "legacy" } | null;

/**
 * Legge `Lead.briefing`: scheda v2 valida, oppure "legacy" se è un briefing della versione precedente
 * (o un JSON non più leggibile), null se assente.
 */
export function parseResearch(raw: string | null | undefined): ParsedResearch {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === "object" && (json as { v?: unknown }).v === 2) {
      const p = ResearchSchema.safeParse(json);
      if (p.success) return { kind: "ok", research: normalizeResearch(p.data) };
    }
  } catch {
    /* non JSON */
  }
  return { kind: "legacy" };
}

/** Solo la scheda v2 (null per assente o formato precedente). */
export function researchOf(raw: string | null | undefined): Research | null {
  const p = parseResearch(raw);
  return p?.kind === "ok" ? p.research : null;
}

const isHttp = (u: string | null | undefined) => Boolean(u && /^https?:\/\//i.test(u));
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const orNull = (s: string | null | undefined) => clean(s) || null;
const cleanList = (a: string[]) => [...new Set(a.map(clean).filter(Boolean))];
/** Accetta solo URL http(s); aggiunge https:// a un dominio nudo. */
function urlOrNull(s: string | null | undefined) {
  const t = clean(s);
  if (!t) return null;
  if (isHttp(t)) return t;
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(t) ? `https://${t}` : null;
}

/** Converte l'output del modello nel formato salvato (testi vuoti → null). */
export function researchFromOutput(o: ResearchOutput, sources: Source[], demo = false): Research {
  return normalizeResearch({ v: 2, ...o, sources, ...(demo && { demo: true }) } as unknown as Research);
}

/** Ripulisce una scheda: trim, voci vuote, duplicati, URL non http(s). */
export function normalizeResearch(r: Research): Research {
  const seen = new Set<string>();
  const sources = r.sources.filter((s) => {
    if (!isHttp(s.url) || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  }).map((s) => ({ title: clean(s.title) || hostOf(s.url), url: s.url }));
  const rating = r.online.googleRating;
  return {
    ...r,
    v: 2,
    summary: clean(r.summary),
    business: {
      type: orNull(r.business.type), offering: orNull(r.business.offering), openingHours: orNull(r.business.openingHours),
      priceLevel: orNull(r.business.priceLevel), foundedOrSince: orNull(r.business.foundedOrSince), size: orNull(r.business.size),
      locations: cleanList(r.business.locations ?? []),
    },
    people: (r.people ?? []).map((p) => ({ name: clean(p.name), role: orNull(p.role), source: orNull(p.source) })).filter((p) => p.name),
    online: {
      website: urlOrNull(r.online.website), phone: orNull(r.online.phone), email: orNull(r.online.email)?.toLowerCase() ?? null,
      socials: (r.online.socials ?? []).map((s) => ({ platform: clean(s.platform), url: urlOrNull(s.url) ?? "" })).filter((s) => s.platform && s.url),
      googleRating: rating != null && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
      reviewsCount: r.online.reviewsCount != null && r.online.reviewsCount >= 0 ? Math.round(r.online.reviewsCount) : null,
      otherListings: (r.online.otherListings ?? []).map((l) => ({ name: clean(l.name), url: urlOrNull(l.url), detail: orNull(l.detail) })).filter((l) => l.name),
    },
    reputation: { overall: orNull(r.reputation.overall), positives: cleanList(r.reputation.positives ?? []), negatives: cleanList(r.reputation.negatives ?? []) },
    facts: (r.facts ?? []).map((f) => ({ text: clean(f.text), sourceUrl: urlOrNull(f.sourceUrl) })).filter((f) => f.text),
    signals: (r.signals ?? []).map((s) => ({ label: clean(s.label), detail: clean(s.detail) })).filter((s) => s.label),
    unknowns: cleanList(r.unknowns ?? []),
    sources,
  };
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Testo piano della scheda (per "Copia" e come contesto per punteggio e assistente). */
export function researchToText(r: Research, leadName?: string) {
  const L: string[] = [];
  const kv = (k: string, v: string | number | null | undefined) => { if (v != null && v !== "") L.push(`${k}: ${v}`); };
  const list = (title: string, items: string[]) => { if (items.length) L.push("", title, ...items.map((i) => `• ${i}`)); };
  if (leadName) L.push(`SCHEDA AI — ${leadName}`, "");
  L.push("SINTESI", r.summary, "");
  L.push("ATTIVITÀ");
  kv("Tipo", r.business.type); kv("Offerta", r.business.offering); kv("Orari", r.business.openingHours);
  kv("Prezzi", r.business.priceLevel); kv("Attiva dal", r.business.foundedOrSince); kv("Dimensione", r.business.size);
  if (r.business.locations.length) kv("Sedi", r.business.locations.join("; "));
  list("PERSONE", r.people.map((p) => `${p.name}${p.role ? ` — ${p.role}` : ""}${p.source ? ` (fonte: ${p.source})` : ""}`));
  L.push("", "ONLINE");
  kv("Sito", r.online.website); kv("Telefono", r.online.phone); kv("Email", r.online.email);
  if (r.online.googleRating != null) kv("Google", `${r.online.googleRating}/5${r.online.reviewsCount != null ? ` su ${r.online.reviewsCount} recensioni` : ""}`);
  for (const s of r.online.socials) kv(s.platform, s.url);
  for (const l of r.online.otherListings) kv(l.name, [l.detail, l.url].filter(Boolean).join(" · "));
  if (r.reputation.overall || r.reputation.positives.length || r.reputation.negatives.length) {
    L.push("", "RECENSIONI");
    if (r.reputation.overall) L.push(r.reputation.overall);
    for (const p of r.reputation.positives) L.push(`+ ${p}`);
    for (const n of r.reputation.negatives) L.push(`− ${n}`);
  }
  list("FATTI", r.facts.map((f) => `${f.text}${f.sourceUrl ? ` (${f.sourceUrl})` : ""}`));
  list("SEGNALI", r.signals.map((s) => `${s.label}: ${s.detail}`));
  list("DA VERIFICARE", r.unknowns);
  L.push("", `Affidabilità: ${r.confidence}`);
  if (r.sources.length) L.push("", "FONTI", ...r.sources.map((s) => `${s.title}: ${s.url}`));
  return L.join("\n");
}

/** Dati di contatto trovati dalla scheda che mancano nella scheda cliente. */
export type ResearchContactSuggestion = Partial<Record<"phone" | "email" | "website" | "contactName" | "contactRole", string>>;

export function contactSuggestions(
  r: Research,
  lead: { phone: string | null; email: string | null; website: string | null; contactName: string | null },
): ResearchContactSuggestion {
  const out: ResearchContactSuggestion = {};
  if (!lead.phone && r.online.phone) out.phone = r.online.phone;
  if (!lead.email && r.online.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.online.email)) out.email = r.online.email;
  if (!lead.website && r.online.website) out.website = r.online.website;
  const person = r.people[0];
  if (!lead.contactName && person) {
    out.contactName = person.name;
    if (person.role) out.contactRole = person.role;
  }
  return out;
}

export const ResearchRequestSchema = z.object({ leadId: z.string().min(1).max(64) });

/** Eventi NDJSON di POST /api/ai/briefing (Scheda AI). */
export type ResearchEvent =
  | { type: "status"; phase: "context" | "research" | "writing" | "saving"; message: string }
  | { type: "source"; source: Source }
  | { type: "done"; research: Research; researchAt: string; demo: boolean }
  | { type: "error"; message: string };

/* ---------------------------------- Chat ---------------------------------- */

export const ChatRequestSchema = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  message: z.string().trim().min(1, "Scrivi un messaggio").max(8000, "Messaggio troppo lungo (max 8000 caratteri)"),
  leadId: z.string().min(1).max(64).optional(),
});

/** Azione eseguita da un tool durante la risposta (mostrata nella UI). */
export type ChatAction = {
  tool: string;
  label: string;
  /** true per azioni che modificano il CRM. */
  write: boolean;
  ok: boolean;
  leadId?: string;
};

/** Eventi NDJSON di POST /api/ai/chat. */
export type ChatEvent =
  | { type: "start"; conversationId: string; title: string; demo: boolean }
  | { type: "delta"; text: string }
  | { type: "status"; message: string | null }
  | { type: "action"; action: ChatAction }
  | { type: "source"; source: Source }
  | { type: "title"; title: string }
  | { type: "done"; conversationId: string; messageId: string }
  | { type: "error"; message: string };

/** Metadati UI salvati in `Message.raw` accanto ai content block API. */
export type MessageMeta = { sources?: Source[]; actions?: ChatAction[]; demo?: boolean; stopped?: "refusal" | "max_tokens" | "error" };

export type ConversationSummary = { id: string; title: string; leadId: string | null; updatedAt: string; lead?: { id: string; name: string } | null };
export type ChatMessageView = { id: string; role: "user" | "assistant"; content: string; createdAt: string } & MessageMeta;
