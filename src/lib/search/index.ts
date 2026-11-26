import "server-only";
// Orchestratore della ricerca: Google (se configurato) → OpenStreetMap → dati demo.
import { matchCategory } from "./categories";
import { generateDemoResults } from "./demo";
import { ProviderUnavailableError, SearchError } from "./errors";
import { parseLatLng } from "./geo";
import { googleEnabled, googleGeocode, searchGoogle } from "./google";
import { geocode } from "./nominatim";
import { searchOverpass } from "./overpass";
import type { ProviderOutcome, SearchCenter, SearchParams } from "./types";

export { SearchError } from "./errors";

export const isLeadsDemoMode = () => process.env.LEADS_DEMO_MODE === "true";

function demo(params: SearchParams, notice: string, center?: SearchCenter): ProviderOutcome {
  const { center: c, results } = generateDemoResults({ ...params, center });
  return { provider: "demo", center: c, results, notice };
}

// Dopo un errore di rete evitiamo di ritentare OpenStreetMap per un minuto (risposte più rapide).
const OSM_COOLDOWN_MS = 60_000;
const g = globalThis as unknown as { __apOsmDownUntil?: number };
const osmDown = () => (g.__apOsmDownUntil ?? 0) > Date.now();
const markOsmDown = () => { g.__apOsmDownUntil = Date.now() + OSM_COOLDOWN_MS; };

const OFFLINE_NOTICE = "OpenStreetMap non è raggiungibile in questo momento: stai vedendo attività di esempio, non reali.";

async function resolveCenter(location: string): Promise<SearchCenter | null> {
  const coords = parseLatLng(location);
  if (coords) return { ...coords, label: "La tua posizione" };
  try {
    if (osmDown()) throw new ProviderUnavailableError("OpenStreetMap temporaneamente non disponibile");
    return await geocode(location);
  } catch (err) {
    if (!(err instanceof ProviderUnavailableError)) throw err;
    if (!osmDown()) console.warn("[search] geocoding non disponibile:", err.message);
    markOsmDown();
    const viaGoogle = googleEnabled() ? await googleGeocode(location).catch(() => null) : null;
    return viaGoogle;
  }
}

export async function searchPlaces(params: SearchParams): Promise<ProviderOutcome> {
  if (isLeadsDemoMode()) return demo(params, "Modalità demo attiva: i risultati sono attività di esempio.");

  const center = await resolveCenter(params.location);
  if (!center) return demo(params, OFFLINE_NOTICE);

  let notice: string | null = null;
  if (googleEnabled()) {
    try {
      const results = await searchGoogle({ query: params.query, locationLabel: parseLatLng(params.location) ? "" : center.label, center, radiusKm: params.radiusKm });
      return { provider: "google", center, results, notice: null };
    } catch (err) {
      console.warn("[search] Google Places non disponibile, ripiego su OpenStreetMap:", err instanceof Error ? err.message : err);
      notice = "Google Places non ha risposto: risultati da OpenStreetMap.";
    }
  }

  if (osmDown()) return demo(params, OFFLINE_NOTICE, center);
  try {
    const results = await searchOverpass({ category: matchCategory(params.query), text: params.query, center, radiusKm: params.radiusKm });
    return { provider: "osm", center, results, notice };
  } catch (err) {
    if (err instanceof SearchError) throw err;
    console.warn("[search] Overpass non disponibile, uso dati demo:", err instanceof Error ? err.message : err);
    markOsmDown();
    return demo(params, OFFLINE_NOTICE, center);
  }
}
