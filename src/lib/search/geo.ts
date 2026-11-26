import type { GeoPoint } from "./types";

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Distanza ortodromica (haversine) in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Arrotonda la distanza a 10 metri. */
export const roundKm = (km: number) => Math.round(km * 100) / 100;

/**
 * Riconosce una posizione nel formato "lat,lng" (es. dalla geolocalizzazione del browser).
 * Restituisce null se il testo non è una coppia di coordinate valida.
 */
export function parseLatLng(text: string): GeoPoint | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Proiezione equirettangolare locale: spostamento in km (x verso est, y verso nord)
 * di un punto rispetto al centro. Precisa per raggi di poche decine di km.
 */
export function projectKm(center: GeoPoint, p: GeoPoint): { x: number; y: number } {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(toRad(center.lat));
  return { x: (p.lng - center.lng) * kmPerDegLng, y: (p.lat - center.lat) * kmPerDegLat };
}

/** Punto a una certa distanza (km) e direzione (radianti, 0 = nord, senso orario) dal centro. */
export function offsetPoint(center: GeoPoint, distanceKm: number, bearingRad: number): GeoPoint {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(toRad(center.lat));
  return {
    lat: center.lat + (distanceKm * Math.cos(bearingRad)) / kmPerDegLat,
    lng: center.lng + (distanceKm * Math.sin(bearingRad)) / kmPerDegLng,
  };
}
