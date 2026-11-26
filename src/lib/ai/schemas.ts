// Schemi e tipi condivisi delle funzioni AI. Sicuri sia lato server sia lato client (niente import server).
import { z } from "zod";

/* ---------------------------------- Lead score ---------------------------------- */

export const ScoreFactorSchema = z.object({
  label: z.string().describe("Etichetta breve del fattore, max 4 parole (es. 'Recensioni ottime')"),
  impact: z.enum(["+", "-"]).describe("'+' se aumenta il potenziale, '-' se lo riduce"),
  detail: z.string().describe("Spiegazione concreta in una frase, citando il dato"),
});

/** Output strutturato richiesto al modello per ogni lead. */
export const ScoreOutputSchema = z.object({
  score: z.number().describe("Punteggio intero di priorità commerciale da 0 a 100"),
  summary: z.string().describe("Sintesi in una frase del perché del punteggio"),
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

export type ScoreResult = { leadId: string; score: number; summary: string };
export type ScoreResponse = { results: ScoreResult[]; errors?: { leadId: string; error: string }[]; demo: boolean };

/* ---------------------------------- Briefing ---------------------------------- */

export const SourceSchema = z.object({ title: z.string(), url: z.string() });
export type Source = z.infer<typeof SourceSchema>;

/** Struttura richiesta al modello (output_config.format). Le fonti vengono aggiunte dal server. */
export const BriefingOutputSchema = z.object({
  snapshot: z.string().describe("Chi è il cliente in 2-3 frasi: attività, posizionamento, dati salienti"),
  whyNow: z.string().describe("Perché vale la pena visitarlo adesso, in 1-2 frasi"),
  talkingPoints: z.array(z.string()).describe("3-5 argomenti da toccare, concreti e legati all'offerta"),
  likelyObjections: z
    .array(z.object({ objection: z.string(), response: z.string() }))
    .describe("2-4 obiezioni probabili con risposta pronta"),
  offerToPropose: z.string().describe("Offerta o prodotto di ingresso da proporre, con motivazione"),
  openingLine: z.string().describe("Frase d'apertura naturale da dire entrando, in italiano parlato"),
  questionsToAsk: z.array(z.string()).describe("3-5 domande di scoperta aperte"),
  nextStep: z.string().describe("Prossimo passo concreto da ottenere alla fine della visita"),
});
export type BriefingOutput = z.infer<typeof BriefingOutputSchema>;

export const BriefingSchema = BriefingOutputSchema.extend({
  sources: z.array(SourceSchema).default([]),
  demo: z.boolean().optional(),
});
export type Briefing = z.infer<typeof BriefingSchema>;

/** Valida il JSON salvato in `Lead.briefing`; null se assente o malformato. */
export function parseBriefing(raw: string | null | undefined): Briefing | null {
  if (!raw) return null;
  try {
    const parsed = BriefingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? normalizeBriefing(parsed.data) : null;
  } catch {
    return null;
  }
}

/** Ripulisce un briefing: trim, elimina voci vuote, deduplica e filtra le fonti non http(s). */
export function normalizeBriefing(b: Briefing): Briefing {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const list = (a: string[]) => a.map(clean).filter(Boolean);
  const seen = new Set<string>();
  const sources = b.sources.filter((s) => {
    if (!/^https?:\/\//i.test(s.url) || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  }).map((s) => ({ title: clean(s.title) || hostOf(s.url), url: s.url }));
  return {
    ...b,
    snapshot: clean(b.snapshot),
    whyNow: clean(b.whyNow),
    talkingPoints: list(b.talkingPoints),
    likelyObjections: b.likelyObjections
      .map((o) => ({ objection: clean(o.objection), response: clean(o.response) }))
      .filter((o) => o.objection && o.response),
    offerToPropose: clean(b.offerToPropose),
    openingLine: clean(b.openingLine),
    questionsToAsk: list(b.questionsToAsk),
    nextStep: clean(b.nextStep),
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

/** Testo piano del briefing (per "Copia tutto"). */
export function briefingToText(b: Briefing, leadName?: string) {
  const lines: string[] = [];
  if (leadName) lines.push(`BRIEFING VISITA — ${leadName}`, "");
  lines.push("IN SINTESI", b.snapshot, "", "PERCHÉ ORA", b.whyNow, "", "FRASE D'APERTURA", `«${b.openingLine}»`, "");
  lines.push("ARGOMENTI", ...b.talkingPoints.map((t) => `• ${t}`), "");
  lines.push("OFFERTA DA PROPORRE", b.offerToPropose, "");
  lines.push("DOMANDE DA FARE", ...b.questionsToAsk.map((q, i) => `${i + 1}. ${q}`), "");
  lines.push("OBIEZIONI PROBABILI", ...b.likelyObjections.flatMap((o) => [`— «${o.objection}»`, `  → ${o.response}`]), "");
  lines.push("PROSSIMO PASSO", b.nextStep);
  if (b.sources.length) lines.push("", "FONTI", ...b.sources.map((s) => `${s.title}: ${s.url}`));
  return lines.join("\n");
}

export const BriefingRequestSchema = z.object({ leadId: z.string().min(1).max(64) });

/** Eventi NDJSON di POST /api/ai/briefing. */
export type BriefingEvent =
  | { type: "status"; phase: "context" | "research" | "writing" | "saving"; message: string }
  | { type: "source"; source: Source }
  | { type: "done"; briefing: Briefing; briefingAt: string; demo: boolean }
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
