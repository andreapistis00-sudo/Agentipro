import "server-only";
// Configurazione condivisa delle chiamate a Claude e utilità per lo streaming NDJSON.
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, tooMany } from "@/lib/search/rate-limit";

/**
 * Fallback lato server sulle richieste a Opus 5.5: se il modello declina per policy, l'API ripete
 * la stessa richiesta sul modello di fallback predefinito nella stessa chiamata.
 * Richiede il namespace beta (`client.beta.messages`) e l'header `server-side-fallback-2026-07-01`.
 */
export const SMART_BETA = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} satisfies Pick<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, "betas" | "fallbacks">;

/**
 * Chat multi-turno: oltre al fallback, `thinking-binding-controls-2026-08-01` permette di impostare
 * esplicitamente `thinking.block_binding.prefix_mismatch_behavior` (vedi chat.ts). La cronologia è append-only,
 * quindi in condizioni normali nessun blocco viene scartato; "drop_block" serve a degradare invece di
 * rispondere 400 se il prefisso cambia per cause legittime (un deploy che modifica tool o prompt di sistema
 * delle conversazioni già aperte). Sui primi turni il valore impostato non cambia nulla.
 */
export const CHAT_BETA = {
  betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
  fallbacks: "default",
} satisfies Pick<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, "betas" | "fallbacks">;

/**
 * Content block da rispedire dopo una risposta. Dopo un fallback lato server a metà output, i blocchi del
 * modello che ha declinato prima dell'ultimo blocco `fallback` (thinking, tool_use, server_tool_use senza
 * risultato) vanno omessi; il blocco `fallback` resta dov'è. Senza fallback il contenuto torna invariato.
 */
export function echoContent(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlock[] {
  let boundary = -1;
  for (let i = content.length - 1; i >= 0; i--) if (content[i].type === "fallback") { boundary = i; break; }
  if (boundary < 0) return content;
  const before = content.slice(0, boundary);
  const resultIds = new Set(
    before.flatMap((b) => ("tool_use_id" in b && typeof b.tool_use_id === "string" ? [b.tool_use_id] : [])),
  );
  const kept = before.filter((b) => {
    if (b.type === "text") return true;
    if (b.type === "server_tool_use") return resultIds.has(b.id);
    if (b.type.endsWith("_tool_result")) return true;
    return false; // thinking, redacted_thinking, tool_use e blocchi interni sconosciuti
  });
  return [...kept, ...content.slice(boundary)];
}

/** Ricerca web lato server, localizzata in Italia. */
export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
  user_location: { type: "approximate", country: "IT", timezone: "Europe/Rome" },
} satisfies Anthropic.Beta.BetaWebSearchTool20260209;

/**
 * Limite di frequenza per le chiamate AI a pagamento (solo con chiave reale: in demo non costano nulla).
 * Restituisce una risposta 429 pronta oppure null.
 */
export function aiRateLimit(userId: string, feature: "chat" | "briefing" | "score", demo: boolean) {
  if (demo) return null;
  const [limit, windowMs] = { chat: [20, 60_000], briefing: [10, 10 * 60_000], score: [20, 10 * 60_000] }[feature];
  const r = rateLimit(`ai-${feature}:${userId}`, limit, windowMs);
  return r.ok ? null : tooMany(r.retryAfterSec, `Hai usato molto l'AI in poco tempo. Riprova tra ${r.retryAfterSec} secondi.`);
}

/** Messaggio d'errore in italiano per l'utente, a partire dalle eccezioni tipizzate dell'SDK. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Chiave API di Claude non valida: controlla ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.PermissionDeniedError) return "La chiave API non ha i permessi per questo modello.";
  if (err instanceof Anthropic.RateLimitError) return "Troppe richieste a Claude in questo momento: riprova tra qualche secondo.";
  if (err instanceof Anthropic.BadRequestError) return "Richiesta non valida per Claude. Se il problema persiste, contatta l'assistenza.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Claude non ha risposto in tempo: riprova.";
  if (err instanceof Anthropic.APIConnectionError) return "Impossibile raggiungere Claude: controlla la connessione del server.";
  if (err instanceof Anthropic.InternalServerError) return "Claude è momentaneamente sovraccarico o non disponibile: riprova tra poco.";
  if (err instanceof Anthropic.APIError) return `Errore del servizio AI${err.status ? ` (${err.status})` : ""}: riprova tra poco.`;
  if (err instanceof RefusalError) return err.message;
  return "Si è verificato un errore inatteso con l'AI. Riprova.";
}

/** Il modello ha rifiutato la richiesta (stop_reason "refusal"). */
export class RefusalError extends Error {
  constructor(message = "Claude non può aiutarti con questa richiesta. Prova a riformularla.") {
    super(message);
  }
}

/**
 * Crea una Response NDJSON (un oggetto JSON per riga) alimentata da `run`.
 * `run` riceve `send` per emettere eventi; il client legge riga per riga.
 */
export function ndjsonResponse<E>(run: (send: (event: E) => void, signal: AbortSignal) => Promise<void>, onError: (err: unknown) => E) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: E) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await run(send, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("[ai]", err);
          send(onError(err));
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* già chiuso */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

/** Esegue `fn` su ogni elemento con al massimo `limit` esecuzioni in parallelo, preservando l'ordine. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
