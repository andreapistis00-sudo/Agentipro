// Rate limit in memoria a finestra scorrevole (per istanza del server).
// Conservato su globalThis per sopravvivere all'hot reload in sviluppo.
const g = globalThis as unknown as { __apSearchRateLimit?: Map<string, number[]> };
const buckets = (g.__apSearchRateLimit ??= new Map<string, number[]>());

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
