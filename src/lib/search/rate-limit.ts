// Rate limit in memoria a finestra scorrevole (per istanza del server).
// Conservato su globalThis per sopravvivere all'hot reload in sviluppo.
const g = globalThis as unknown as { __apSearchRateLimit?: Map<string, number[]> };
const buckets = (g.__apSearchRateLimit ??= new Map<string, number[]>());

/** Come `rateLimit` ma senza registrare un nuovo tentativo (per contare solo i fallimenti). */
export function peekRateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length < limit) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
}

/** Chiave del client per i limiti non legati a un utente (login/registrazione). */
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Risposta 429 standard. */
export function tooMany(retryAfterSec: number, message = `Troppe richieste in poco tempo. Riprova tra ${retryAfterSec} secondi.`) {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true };
}
