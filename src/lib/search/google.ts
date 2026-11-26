// Google Places API (New) – Text Search. Usato solo se GOOGLE_PLACES_API_KEY è impostata.
import { ProviderUnavailableError, SearchError, fetchWithTimeout } from "./errors";
import { haversineKm, roundKm } from "./geo";
import { normalizeWebsite } from "./overpass";
import { MAX_RESULTS, type GeoPoint, type SearchResult } from "./types";

export const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const MAX_PAGES = 3; // 3 × 20 = 60 risultati

export const GOOGLE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.addressComponents",
  "nextPageToken",
].join(",");

export type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

export type GoogleResponse = { places?: GooglePlace[]; nextPageToken?: string };

export const googleEnabled = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

/** Corpo della richiesta Text Search. */
export function buildGoogleRequest(opts: { query: string; locationLabel: string; center: GeoPoint; radiusKm: number; pageToken?: string }) {
  return {
    textQuery: opts.locationLabel ? `${opts.query} ${opts.locationLabel}` : opts.query,
    languageCode: "it",
    regionCode: "IT",
    pageSize: 20,
    locationBias: {
      circle: {
        center: { latitude: opts.center.lat, longitude: opts.center.lng },
        radius: Math.min(50_000, Math.round(opts.radiusKm * 1000)),
      },
    },
    ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
  };
}

function cityFromComponents(components: GooglePlace["addressComponents"]): string | null {
  if (!components) return null;
  for (const type of ["locality", "postal_town", "administrative_area_level_3", "sublocality"]) {
    const c = components.find((x) => x.types?.includes(type));
    if (c?.longText) return c.longText;
  }
  return null;
}

/** Converte i luoghi Google in SearchResult; scarta quelli senza nome/coordinate o fuori raggio. */
export function parseGooglePlaces(places: GooglePlace[], center: GeoPoint, radiusKm: number): SearchResult[] {
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const p of places) {
    const name = p.displayName?.text?.trim();
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!p.id || !name || lat == null || lng == null || seen.has(p.id)) continue;
    const distanceKm = roundKm(haversineKm(center, { lat, lng }));
    if (distanceKm > radiusKm) continue;
    seen.add(p.id);
    out.push({
      sourceId: p.id,
      source: "google",
      name,
      category: p.primaryTypeDisplayName?.text ?? null,
      address: p.formattedAddress?.replace(/,\s*Italia$/i, "") ?? null,
      city: cityFromComponents(p.addressComponents),
      lat,
      lng,
      phone: p.nationalPhoneNumber ?? null,
      email: null,
      website: normalizeWebsite(p.websiteUri),
      openingHours: p.regularOpeningHours?.weekdayDescriptions?.join("; ") || null,
      rating: p.rating ?? null,
      reviewsCount: p.userRatingCount ?? null,
      distanceKm,
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_RESULTS);
}

export async function searchGoogle(opts: { query: string; locationLabel: string; center: GeoPoint; radiusKm: number }): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new SearchError("Google Places non è configurato", 500);
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchWithTimeout(GOOGLE_TEXT_SEARCH_URL, {
      service: "Google Places",
      timeoutMs: 10_000,
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": GOOGLE_FIELD_MASK },
      body: JSON.stringify(buildGoogleRequest({ ...opts, pageToken })),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new ProviderUnavailableError(`Google Places ha risposto con errore ${res.status}${detail?.error?.message ? `: ${detail.error.message}` : ""}`);
    }
    const data = (await res.json()) as GoogleResponse;
    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return parseGooglePlaces(places, opts.center, opts.radiusKm);
}

/** Geocoding di riserva tramite Google (se Nominatim non risponde). */
export async function googleGeocode(location: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const res = await fetchWithTimeout(GOOGLE_TEXT_SEARCH_URL, {
    service: "Google Places",
    timeoutMs: 8000,
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.location,places.formattedAddress" },
    body: JSON.stringify({ textQuery: location, languageCode: "it", regionCode: "IT", pageSize: 1 }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as GoogleResponse | null;
  const p = data?.places?.[0];
  if (p?.location?.latitude == null || p.location.longitude == null) return null;
  return { lat: p.location.latitude, lng: p.location.longitude, label: p.formattedAddress?.replace(/,\s*Italia$/i, "") || location };
}
