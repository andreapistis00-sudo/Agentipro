// Tipi condivisi della ricerca lead (usabili sia lato server sia lato client).

export type SearchSource = "osm" | "google" | "demo";

/** Un'attività trovata da un provider, normalizzata. */
export type SearchResult = {
  /** Identificativo stabile presso il provider (es. "node/123", place id Google). */
  sourceId: string;
  source: SearchSource;
  name: string;
  /** Categoria leggibile in italiano (es. "Bar", "Parrucchiere"). */
  category: string | null;
  /** Indirizzo completo (via, civico, CAP, città). */
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  rating: number | null;
  reviewsCount: number | null;
  /** Distanza dal centro della ricerca, in km. */
  distanceKm: number;
};

export type GeoPoint = { lat: number; lng: number };

/** Centro geocodificato della ricerca. */
export type SearchCenter = GeoPoint & { label: string };

export type SearchParams = {
  query: string;
  location: string;
  radiusKm: number;
};

/** Esito di un provider. */
export type ProviderOutcome = {
  provider: SearchSource;
  center: SearchCenter;
  results: SearchResult[];
  /** Avviso per l'utente (es. ripiego su dati demo). */
  notice: string | null;
};

/** Risultato arricchito con lo stato nel CRM dell'utente. */
export type SearchResultWithStatus = SearchResult & { alreadySaved: boolean; leadId: string | null };

/** Contratto di risposta di POST /api/search. */
export type SearchResponse = {
  searchId: string;
  provider: SearchSource;
  demo: boolean;
  notice: string | null;
  center: SearchCenter;
  query: string;
  location: string;
  radiusKm: number;
  results: SearchResultWithStatus[];
};

/** Voce dello storico (GET /api/search). */
export type RecentSearch = {
  id: string;
  query: string;
  location: string;
  radiusKm: number;
  results: number;
  createdAt: string;
};

export type ImportResponse = {
  created: number;
  skipped: number;
  leads: { id: string; sourceId: string }[];
};

/** Numero massimo di risultati restituiti da una ricerca. */
export const MAX_RESULTS = 100;
