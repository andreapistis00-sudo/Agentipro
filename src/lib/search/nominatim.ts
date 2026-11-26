// Geocoding con Nominatim (OpenStreetMap). Rispetta la policy d'uso: 1 richiesta/s, User-Agent, cache.
import { ProviderUnavailableError, SearchError, fetchWithTimeout, isUnavailableStatus } from "./errors";
import { normalize } from "./categories";
import type { SearchCenter } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const USER_AGENT = "Agentipro/1.0";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MIN_INTERVAL_MS = 1100;

type NominatimItem = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
};

const g = globalThis as unknown as { __apGeocodeCache?: Map<string, { at: number; value: SearchCenter }> };
const cache = (g.__apGeocodeCache ??= new Map());
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Serializza le richieste con almeno ~1 s di distanza tra l'una e l'altra. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

/** Etichetta breve: "Milano", "Via Roma, Torino"... */
export function shortLabel(item: NominatimItem, fallback: string): string {
  const a = item.address ?? {};
  const city = a.city || a.town || a.village || a.municipality || a.hamlet || a.county;
  const street = a.road ? [a.road, a.house_number].filter(Boolean).join(" ") : null;
  const parts = [street ?? item.name, city].filter((x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i);
  return parts.join(", ") || item.display_name?.split(",").slice(0, 2).join(",").trim() || fallback;
}

export async function geocode(location: string, opts: { countryCodes?: string } = {}): Promise<SearchCenter> {
  const countryCodes = opts.countryCodes ?? process.env.SEARCH_COUNTRYCODES ?? "it";
  const key = `${countryCodes}|${normalize(location)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const params = new URLSearchParams({ q: location, format: "jsonv2", limit: "1", addressdetails: "1", "accept-language": "it" });
  if (countryCodes) params.set("countrycodes", countryCodes);

  const value = await throttled(async () => {
    const res = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`, {
      service: "Il servizio di geolocalizzazione",
      timeoutMs: 8000,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (isUnavailableStatus(res.status)) throw new ProviderUnavailableError(`Geolocalizzazione non disponibile (HTTP ${res.status})`);
    if (!res.ok) throw new SearchError(`Impossibile interpretare il luogo "${location}"`);
    const items = (await res.json().catch(() => null)) as NominatimItem[] | null;
    const first = Array.isArray(items) ? items[0] : undefined;
    if (!first) throw new SearchError(`Non abbiamo trovato "${location}". Prova con città, indirizzo o CAP.`, 404);
    const center: SearchCenter = { lat: Number(first.lat), lng: Number(first.lon), label: shortLabel(first, location) };
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) throw new SearchError(`Coordinate non valide per "${location}"`);
    return center;
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}
