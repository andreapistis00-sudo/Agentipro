// Generatore deterministico di attività dimostrative (offline / LEADS_DEMO_MODE).
import { matchCategory, normalize, type Category } from "./categories";
import { haversineKm, offsetPoint, parseLatLng, roundKm } from "./geo";
import type { SearchCenter, SearchResult } from "./types";

type City = { name: string; lat: number; lng: number; cap: string; prefix: string; province: string };

export const DEMO_CITIES: City[] = [
  { name: "Milano", lat: 45.4642, lng: 9.19, cap: "20121", prefix: "02", province: "MI" },
  { name: "Roma", lat: 41.9028, lng: 12.4964, cap: "00184", prefix: "06", province: "RM" },
  { name: "Torino", lat: 45.0703, lng: 7.6869, cap: "10121", prefix: "011", province: "TO" },
  { name: "Napoli", lat: 40.8518, lng: 14.2681, cap: "80133", prefix: "081", province: "NA" },
  { name: "Bologna", lat: 44.4949, lng: 11.3426, cap: "40121", prefix: "051", province: "BO" },
  { name: "Firenze", lat: 43.7696, lng: 11.2558, cap: "50122", prefix: "055", province: "FI" },
  { name: "Genova", lat: 44.4056, lng: 8.9463, cap: "16121", prefix: "010", province: "GE" },
  { name: "Venezia", lat: 45.4408, lng: 12.3155, cap: "30121", prefix: "041", province: "VE" },
  { name: "Verona", lat: 45.4384, lng: 10.9916, cap: "37121", prefix: "045", province: "VR" },
  { name: "Padova", lat: 45.4064, lng: 11.8768, cap: "35122", prefix: "049", province: "PD" },
  { name: "Brescia", lat: 45.5416, lng: 10.2118, cap: "25121", prefix: "030", province: "BS" },
  { name: "Bergamo", lat: 45.6983, lng: 9.6773, cap: "24121", prefix: "035", province: "BG" },
  { name: "Monza", lat: 45.5845, lng: 9.2744, cap: "20900", prefix: "039", province: "MB" },
  { name: "Como", lat: 45.8081, lng: 9.0852, cap: "22100", prefix: "031", province: "CO" },
  { name: "Varese", lat: 45.8206, lng: 8.8251, cap: "21100", prefix: "0332", province: "VA" },
  { name: "Trento", lat: 46.0748, lng: 11.1217, cap: "38122", prefix: "0461", province: "TN" },
  { name: "Trieste", lat: 45.6495, lng: 13.7768, cap: "34121", prefix: "040", province: "TS" },
  { name: "Udine", lat: 46.0711, lng: 13.2346, cap: "33100", prefix: "0432", province: "UD" },
  { name: "Parma", lat: 44.8015, lng: 10.3279, cap: "43121", prefix: "0521", province: "PR" },
  { name: "Modena", lat: 44.6471, lng: 10.9252, cap: "41121", prefix: "059", province: "MO" },
  { name: "Reggio Emilia", lat: 44.6989, lng: 10.6297, cap: "42121", prefix: "0522", province: "RE" },
  { name: "Rimini", lat: 44.0678, lng: 12.5695, cap: "47921", prefix: "0541", province: "RN" },
  { name: "Pisa", lat: 43.7228, lng: 10.4017, cap: "56125", prefix: "050", province: "PI" },
  { name: "Ancona", lat: 43.6158, lng: 13.5189, cap: "60121", prefix: "071", province: "AN" },
  { name: "Perugia", lat: 43.1107, lng: 12.3908, cap: "06121", prefix: "075", province: "PG" },
  { name: "Pescara", lat: 42.4618, lng: 14.2161, cap: "65121", prefix: "085", province: "PE" },
  { name: "Bari", lat: 41.1171, lng: 16.8719, cap: "70121", prefix: "080", province: "BA" },
  { name: "Lecce", lat: 40.3515, lng: 18.175, cap: "73100", prefix: "0832", province: "LE" },
  { name: "Salerno", lat: 40.6824, lng: 14.7681, cap: "84121", prefix: "089", province: "SA" },
  { name: "Reggio Calabria", lat: 38.1113, lng: 15.6473, cap: "89121", prefix: "0965", province: "RC" },
  { name: "Palermo", lat: 38.1157, lng: 13.3615, cap: "90133", prefix: "091", province: "PA" },
  { name: "Catania", lat: 37.5079, lng: 15.083, cap: "95121", prefix: "095", province: "CT" },
  { name: "Cagliari", lat: 39.2238, lng: 9.1217, cap: "09124", prefix: "070", province: "CA" },
];

/* ---------- PRNG deterministico ---------- */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/* ---------- Geocoding offline ---------- */
function cityByText(location: string): City | null {
  const n = normalize(location);
  const cap = n.match(/\b(\d{5})\b/)?.[1];
  if (cap) {
    const byCap = DEMO_CITIES.find((c) => c.cap.slice(0, 3) === cap.slice(0, 3));
    if (byCap) return byCap;
  }
  // La città nominata più lunga vince (es. "Reggio Emilia" prima di "Reggio")
  const sorted = [...DEMO_CITIES].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((c) => new RegExp(`\\b${normalize(c.name)}\\b`).test(n)) ?? null;
}

function nearestCity(p: { lat: number; lng: number }): City {
  return DEMO_CITIES.reduce((best, c) => (haversineKm(p, c) < haversineKm(p, best) ? c : best), DEMO_CITIES[0]);
}

const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (m) => m.toUpperCase());

/** Geocoding approssimato senza rete: città note, CAP, coordinate; altrimenti un punto plausibile. */
export function demoGeocode(location: string): SearchCenter & { city: City } {
  const coords = parseLatLng(location);
  if (coords) {
    const city = nearestCity(coords);
    const near = haversineKm(coords, city) < 25;
    return { ...coords, label: near ? `La tua posizione · ${city.name}` : "La tua posizione", city };
  }
  const known = cityByText(location);
  if (known) {
    const n = normalize(location);
    const exact = n === normalize(known.name);
    return { lat: known.lat, lng: known.lng, label: exact ? known.name : titleCase(location), city: known };
  }
  // Luogo sconosciuto: un centro plausibile vicino a una città, scelto in modo stabile.
  const rng = mulberry32(hashString(normalize(location)));
  const base = pick(rng, DEMO_CITIES);
  const p = offsetPoint(base, 8 + rng() * 25, rng() * Math.PI * 2);
  return { ...p, label: titleCase(location), city: { ...base, name: titleCase(location) } };
}

/* ---------- Dati per i nomi ---------- */
const FIRST = ["Marco", "Giulia", "Luca", "Francesca", "Andrea", "Chiara", "Paolo", "Sara", "Giorgio", "Elena", "Roberto", "Laura", "Stefano", "Valentina", "Davide", "Martina", "Matteo", "Anna", "Alessandro", "Silvia", "Franco", "Rita", "Enzo", "Nadia"];
const LAST = ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferri", "Galli", "Martini", "Leone"];
const WORDS = ["Centrale", "del Corso", "Italia", "Aurora", "Stella", "Il Portico", "La Piazzetta", "Duomo", "Sole", "La Torre", "Le Logge", "Garibaldi", "Moderno", "Primavera", "Belvedere", "dei Mille", "Ai Navigli", "San Marco", "Liberty", "Elite"];
const STREETS = ["Via Roma", "Via Garibaldi", "Corso Italia", "Via Mazzini", "Via Cavour", "Via Dante", "Via Verdi", "Viale Europa", "Via XX Settembre", "Corso Vittorio Emanuele II", "Via Marconi", "Via Matteotti", "Piazza della Repubblica", "Via Gramsci", "Via San Francesco", "Via Manzoni", "Via dei Mille", "Via Carducci", "Viale della Libertà", "Via Volta", "Via Leopardi", "Via Indipendenza", "Corso Garibaldi", "Via Nazionale"];

type Pattern = (rng: Rng) => string;
const NAMES: Record<string, Pattern[]> = {
  bar: [(r) => `Bar ${pick(r, WORDS)}`, (r) => `Caffè ${pick(r, LAST)}`, (r) => `Bar da ${pick(r, FIRST)}`, (r) => `${pick(r, WORDS)} Café`, (r) => `Caffetteria ${pick(r, WORDS)}`],
  pub: [(r) => `Pub ${pick(r, WORDS)}`, (r) => `Birreria ${pick(r, LAST)}`, (r) => `The ${pick(r, ["Old", "Black", "Green", "Red"])} ${pick(r, ["Lion", "Barrel", "Anchor", "Fox"])}`],
  restaurant: [(r) => `Trattoria da ${pick(r, FIRST)}`, (r) => `Ristorante ${pick(r, WORDS)}`, (r) => `Osteria ${pick(r, LAST)}`, (r) => `Locanda ${pick(r, WORDS)}`],
  pizzeria: [(r) => `Pizzeria ${pick(r, WORDS)}`, (r) => `Pizzeria da ${pick(r, FIRST)}`, (r) => `Forno a legna ${pick(r, LAST)}`],
  hairdresser: [(r) => `Parrucchiera ${pick(r, FIRST)}`, (r) => `Hair Studio ${pick(r, WORDS)}`, (r) => `Acconciature ${pick(r, LAST)}`, (r) => `Salone ${pick(r, FIRST)} & ${pick(r, FIRST)}`],
  barber: [(r) => `Barberia ${pick(r, LAST)}`, (r) => `Barber Shop ${pick(r, WORDS)}`, (r) => `Da ${pick(r, FIRST)} Barbiere`],
  dentist: [(r) => `Studio Dentistico Dott. ${pick(r, LAST)}`, (r) => `Studio Odontoiatrico ${pick(r, LAST)} & ${pick(r, LAST)}`, (r) => `Centro Dentale ${pick(r, WORDS)}`],
  doctor: [(r) => `Poliambulatorio ${pick(r, WORDS)}`, (r) => `Studio Medico Dott.ssa ${pick(r, LAST)}`, (r) => `Centro Medico ${pick(r, WORDS)}`],
  pharmacy: [(r) => `Farmacia ${pick(r, WORDS)}`, (r) => `Farmacia ${pick(r, LAST)}`, (r) => `Farmacia Comunale ${1 + Math.floor(r() * 12)}`],
  hardware: [(r) => `Ferramenta ${pick(r, LAST)}`, (r) => `Ferramenta ${pick(r, WORDS)}`, (r) => `Utensileria ${pick(r, LAST)} S.r.l.`, (r) => `Colori e Ferramenta ${pick(r, FIRST)}`],
  bakery: [(r) => `Panificio ${pick(r, LAST)}`, (r) => `Il Forno di ${pick(r, FIRST)}`, (r) => `Panetteria ${pick(r, WORDS)}`],
  pastry: [(r) => `Pasticceria ${pick(r, LAST)}`, (r) => `Pasticceria ${pick(r, WORDS)}`, (r) => `Dolci Tentazioni di ${pick(r, FIRST)}`],
  car_repair: [(r) => `Autofficina ${pick(r, LAST)}`, (r) => `Carrozzeria ${pick(r, WORDS)}`, (r) => `Officina Meccanica ${pick(r, LAST)} & Figli`, (r) => `Gommista ${pick(r, FIRST)}`],
  hotel: [(r) => `Hotel ${pick(r, WORDS)}`, (r) => `B&B ${pick(r, WORDS)}`, (r) => `Albergo ${pick(r, LAST)}`],
  beauty: [(r) => `Centro Estetico ${pick(r, WORDS)}`, (r) => `Estetica ${pick(r, FIRST)}`, (r) => `Beauty Lab ${pick(r, WORDS)}`],
  accountant: [(r) => `Studio ${pick(r, LAST)} Commercialisti Associati`, (r) => `Dott. ${pick(r, FIRST)} ${pick(r, LAST)} Commercialista`],
  lawyer: [(r) => `Studio Legale ${pick(r, LAST)}`, (r) => `Avv. ${pick(r, FIRST)} ${pick(r, LAST)}`],
};

const OPENING = [
  "Lun-Ven 07:00-19:30; Sab 07:30-13:00",
  "Lun-Sab 08:30-12:30, 15:30-19:30",
  "Mar-Dom 12:00-14:30, 19:00-23:00",
  "Lun-Ven 09:00-13:00, 14:30-18:30",
  "Tutti i giorni 06:30-20:00",
  "Mar-Sab 09:00-19:00",
];

const slug = (s: string) => normalize(s).replace(/&/g, "e").replace(/\b(dott|dott ssa|avv|s r l)\b/g, "").replace(/[^a-z0-9]+/g, "");

function phoneFor(rng: Rng, city: City): string {
  if (rng() < 0.3) {
    const mob = pick(rng, ["333", "335", "338", "340", "347", "349", "366", "389"]);
    return `${mob} ${String(Math.floor(rng() * 9_000_000) + 1_000_000).replace(/(\d{3})(\d{4})/, "$1 $2")}`;
  }
  const digits = 10 - city.prefix.length;
  const n = String(Math.floor(rng() * 10 ** digits)).padStart(digits, "0");
  return `${city.prefix} ${n.slice(0, Math.ceil(digits / 2))} ${n.slice(Math.ceil(digits / 2))}`;
}

/**
 * Genera da 14 a 32 attività plausibili attorno al centro. Stesso input → stessi risultati.
 */
export function generateDemoResults(opts: { query: string; location: string; radiusKm: number; center?: SearchCenter }): {
  center: SearchCenter;
  results: SearchResult[];
} {
  const geo = demoGeocode(opts.location);
  const center = opts.center ?? { lat: geo.lat, lng: geo.lng, label: geo.label };
  const city = geo.city;
  const seed = `${normalize(opts.query)}|${normalize(opts.location)}`;
  const rng = mulberry32(hashString(seed));
  const category: Category | null = matchCategory(opts.query);
  const label = category?.label ?? titleCase(opts.query);
  const patterns: Pattern[] = (category && NAMES[category.id]) || [
    (r) => `${label} ${pick(r, LAST)}`,
    (r) => `${label} ${pick(r, WORDS)}`,
    (r) => `${pick(r, LAST)} ${label}`,
  ];

  // Più risultati con raggi ampi, ma sempre entro un intervallo realistico.
  const count = Math.min(32, Math.max(14, Math.round(12 + Math.sqrt(opts.radiusKm) * 4 + rng() * 6)));
  const names = new Set<string>();
  const results: SearchResult[] = [];
  const idBase = hashString(seed).toString(36);

  for (let i = 0; i < count; i++) {
    let name = pick(rng, patterns)(rng);
    for (let tries = 0; names.has(name) && tries < 5; tries++) name = pick(rng, patterns)(rng);
    if (names.has(name)) name = `${name} ${i + 1}`;
    names.add(name);

    // Distribuzione più densa verso il centro (come in una città reale).
    const dist = opts.radiusKm * Math.pow(rng(), 0.75) * 0.97;
    const p = offsetPoint(center, dist, rng() * Math.PI * 2);
    const street = `${pick(rng, STREETS)} ${1 + Math.floor(rng() * 140)}`;
    const cap = city.cap.slice(0, 3) + String(Math.floor(rng() * 40)).padStart(2, "0");
    const hasSite = rng() < 0.55;
    const domain = `${slug(name)}.it`;
    const rated = rng() < 0.65;

    const lat = Number(p.lat.toFixed(6));
    const lng = Number(p.lng.toFixed(6));
    results.push({
      sourceId: `demo-${idBase}-${i}`,
      source: "demo",
      name,
      category: label,
      address: `${street}, ${cap} ${city.name}`,
      city: city.name,
      lat,
      lng,
      phone: rng() < 0.8 ? phoneFor(rng, city) : null,
      email: hasSite && rng() < 0.6 ? `info@${domain}` : null,
      website: hasSite ? `https://www.${domain}` : null,
      openingHours: rng() < 0.7 ? pick(rng, OPENING) : null,
      rating: rated ? Math.round((3.6 + rng() * 1.4) * 10) / 10 : null,
      reviewsCount: rated ? Math.floor(8 + rng() * rng() * 900) : null,
      distanceKm: roundKm(haversineKm(center, { lat, lng })),
    });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return { center, results };
}
