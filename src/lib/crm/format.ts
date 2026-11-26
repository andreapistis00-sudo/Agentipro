// Helper di formattazione/date per il CRM. Sicuri lato client e server.
// Il fuso è fisso (Europe/Rome) così server e client producono lo stesso output (niente hydration mismatch).
export const TZ = "Europe/Rome";

/** Chiave "YYYY-MM-DD" del giorno di `d` nel fuso italiano. */
export function dayKey(d: Date | string | number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

/** Offset in minuti del fuso italiano rispetto a UTC per l'istante dato. */
function tzOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Istante UTC della mezzanotte italiana del giorno `key` (YYYY-MM-DD). */
export function romeMidnight(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
}

export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Inizio/fine del giorno corrente e inizio settimana (lunedì) nel fuso italiano. */
export function todayBounds(now = new Date()) {
  const key = dayKey(now);
  const start = romeMidnight(key);
  const end = new Date(romeMidnight(addDays(key, 1)).getTime() - 1);
  const [y, m, d] = key.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunedì
  const weekStart = romeMidnight(addDays(key, -dow));
  return { key, start, end, weekStart };
}

/** Le date "solo giorno" (follow-up) si salvano alle 12:00 UTC: stabili in qualsiasi fuso europeo. */
export function dateOnlyToIso(key: string) {
  return `${key}T12:00:00.000Z`;
}

export type DueState = "overdue" | "today" | "soon" | "later";
export function dueState(d: Date | string | null | undefined, now = new Date()): DueState | null {
  if (!d) return null;
  const k = dayKey(d);
  const today = dayKey(now);
  if (k < today) return "overdue";
  if (k === today) return "today";
  if (k <= addDays(today, 3)) return "soon";
  return "later";
}

export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

/** "Oggi", "Domani", "Ieri", "3 giorni fa", altrimenti data breve. */
export function fmtDue(d: Date | string | null | undefined, now = new Date()) {
  if (!d) return "—";
  const today = dayKey(now);
  const k = dayKey(d);
  if (k === today) return "Oggi";
  if (k === addDays(today, 1)) return "Domani";
  if (k === addDays(today, -1)) return "Ieri";
  const diff = Math.round((Date.UTC(...ymd(k)) - Date.UTC(...ymd(today))) / 86400000);
  if (diff < 0 && diff > -14) return `${-diff} giorni fa`;
  if (diff > 0 && diff < 7) return `Tra ${diff} giorni`;
  return fmtDate(d, { day: "numeric", month: "short", year: k.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });
}
function ymd(k: string): [number, number, number] {
  const [y, m, d] = k.split("-").map(Number);
  return [y, m - 1, d];
}

export function parseTags(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of csv.split(",")) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export function serializeTags(tags: string[] | null | undefined) {
  const list = parseTags((tags ?? []).join(","));
  return list.length ? list.join(",") : null;
}

/** URL di Google Maps: coordinate se presenti, altrimenti ricerca per nome + indirizzo. */
export function mapsUrl(l: { name: string; address?: string | null; city?: string | null; lat?: number | null; lng?: number | null }) {
  const query = l.lat != null && l.lng != null ? `${l.lat},${l.lng}` : [l.name, l.address, l.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function websiteHref(site: string) {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export function fmtTime(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
