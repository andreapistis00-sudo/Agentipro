/** Errore da mostrare all'utente (input non valido, luogo non trovato...). */
export class SearchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "SearchError";
  }
}

/** Il servizio esterno non è raggiungibile o non risponde (rete, timeout, 5xx, 429). */
export class ProviderUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * fetch con timeout. Errori di rete e timeout diventano ProviderUnavailableError;
 * le risposte HTTP vengono restituite così come sono.
 */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number; service: string }): Promise<Response> {
  const { timeoutMs = 10_000, service, ...rest } = init;
  try {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = rest.signal ? AbortSignal.any([timeout, rest.signal]) : timeout;
    return await fetch(url, { ...rest, signal, cache: "no-store" });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new ProviderUnavailableError(
      timeout ? `${service} non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi` : `${service} non è raggiungibile`,
      err,
    );
  }
}

/** Status HTTP che indicano un servizio momentaneamente indisponibile. */
export const isUnavailableStatus = (status: number) => status === 429 || status === 403 || status >= 500;
