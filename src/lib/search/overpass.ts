// Ricerca attività con Overpass API (OpenStreetMap).
import { POI_KEYS, categoryLabelFromTags, type Category, type OsmTag } from "./categories";
import { ProviderUnavailableError, SearchError, fetchWithTimeout, isUnavailableStatus } from "./errors";
import { haversineKm, roundKm } from "./geo";
import { USER_AGENT } from "./nominatim";
import { MAX_RESULTS, type GeoPoint, type SearchResult } from "./types";

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const escapeOverpass = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function tagFilter(t: OsmTag): string {
  if (t.v == null) return `["${t.k}"]`;
  if (Array.isArray(t.v)) return `["${t.k}"~"^(${t.v.map(escapeRegex).join("|")})$"]`;
  return `["${t.k}"="${escapeOverpass(t.v)}"]`;
}

/** Costruisce la query Overpass QL per una categoria nota o, in mancanza, per nome. */
export function buildOverpassQuery(opts: { category: Category | null; text: string; center: GeoPoint; radiusKm: number }): string {
  const around = `(around:${Math.round(opts.radiusKm * 1000)},${opts.center.lat.toFixed(6)},${opts.center.lng.toFixed(6)})`;
  const statements = opts.category
    ? opts.category.tags.map((t) => `  nwr${tagFilter(t)}["name"]${around};`)
    : POI_KEYS.map((k) => `  nwr["name"~"${escapeOverpass(escapeRegex(opts.text.trim()))}",i]["${k}"]${around};`);
  return `[out:json][timeout:25];\n(\n${statements.join("\n")}\n);\nout center tags 400;`;
}

const firstValue = (v: string | undefined) => v?.split(";")[0]?.trim() || null;

export function normalizeWebsite(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`;
}

/** Converte gli elementi Overpass in SearchResult (scarta quelli senza nome o coordinate). */
export function parseOverpass(data: { elements?: OverpassElement[] }, center: GeoPoint, category: Category | null): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    const sourceId = `${el.type}/${el.id}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
    const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || tags["addr:hamlet"] || null;
    const locality = [tags["addr:postcode"], city].filter(Boolean).join(" ") || null;
    const address = [street, locality].filter(Boolean).join(", ") || tags["addr:full"] || null;

    out.push({
      sourceId,
      source: "osm",
      name,
      category: categoryLabelFromTags(tags, category),
      address,
      city,
      lat,
      lng,
      phone: firstValue(tags.phone || tags["contact:phone"] || tags["contact:mobile"] || tags.mobile),
      email: firstValue(tags.email || tags["contact:email"]),
      website: normalizeWebsite(firstValue(tags.website || tags["contact:website"] || tags.url)),
      openingHours: tags.opening_hours?.trim() || null,
      rating: null,
      reviewsCount: null,
      distanceKm: roundKm(haversineKm(center, { lat, lng })),
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_RESULTS);
}

/**
 * Esegue la query su tutti gli endpoint Overpass in parallelo e usa la prima risposta valida:
 * i server pubblici sono spesso lenti o saturi, così l'attesa è quella del più veloce.
 */
export async function searchOverpass(opts: { category: Category | null; text: string; center: GeoPoint; radiusKm: number }): Promise<SearchResult[]> {
  const query = buildOverpassQuery(opts);
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());

  const attempt = async (endpoint: string, i: number): Promise<SearchResult[]> => {
    const res = await fetchWithTimeout(endpoint, {
      service: "OpenStreetMap (Overpass)",
      timeoutMs: 25_000,
      method: "POST",
      signal: controllers[i].signal,
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ data: query }).toString(),
    });
    if (isUnavailableStatus(res.status)) throw new ProviderUnavailableError(`Overpass occupato o non disponibile (HTTP ${res.status})`);
    if (!res.ok) throw new SearchError("La ricerca su OpenStreetMap non è valida. Prova con parole diverse.");
    const data = (await res.json().catch(() => null)) as { elements?: OverpassElement[]; remark?: string } | null;
    if (!data) throw new ProviderUnavailableError("Risposta Overpass non leggibile");
    if (!data.elements?.length && data.remark?.includes("timed out")) throw new ProviderUnavailableError("Overpass ha superato il tempo massimo");
    return parseOverpass(data, opts.center, opts.category);
  };

  try {
    const results = await Promise.any(OVERPASS_ENDPOINTS.map(attempt));
    return results;
  } catch (err) {
    const errors = err instanceof AggregateError ? err.errors : [err];
    errors.forEach((e, i) =>
      console.error(`[search] Overpass ${new URL(OVERPASS_ENDPOINTS[i] ?? "http://x").host}: ${e instanceof Error ? `${e.message}${e.cause instanceof Error ? ` (${e.cause.message})` : ""}` : String(e)}`),
    );
    const searchError = errors.find((e) => e instanceof SearchError && !(e instanceof ProviderUnavailableError));
    if (searchError) throw searchError;
    throw new ProviderUnavailableError("OpenStreetMap non è raggiungibile");
  } finally {
    controllers.forEach((c) => c.abort());
  }
}
