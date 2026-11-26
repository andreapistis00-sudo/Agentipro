import type { RecentSearch } from "./types";

type Row = { id: string; query: string; location: string; radiusKm: number; results: number; createdAt: Date };

/** Ultime ricerche distinte (stessa query+luogo+raggio contano una volta), dalla più recente. */
export function dedupeRecent(rows: Row[], limit = 10): RecentSearch[] {
  const seen = new Set<string>();
  const out: RecentSearch[] = [];
  for (const r of rows) {
    const key = `${r.query.trim().toLowerCase()}|${r.location.trim().toLowerCase()}|${r.radiusKm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, query: r.query, location: r.location, radiusKm: r.radiusKm, results: r.results, createdAt: r.createdAt.toISOString() });
    if (out.length === limit) break;
  }
  return out;
}
