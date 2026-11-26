import { z } from "zod";
import { MAX_RESULTS } from "./types";

const str = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

export const SearchBody = z.object({
  query: z.string().trim().min(2, "Scrivi cosa cerchi (almeno 2 caratteri)").max(80, "Ricerca troppo lunga"),
  location: z.string().trim().min(2, "Indica dove cercare").max(120, "Luogo troppo lungo"),
  radiusKm: z.coerce.number().min(0.5, "Raggio minimo 0,5 km").max(50, "Raggio massimo 50 km"),
});

export const SearchResultSchema = z.object({
  sourceId: z.string().trim().min(1).max(200),
  source: z.enum(["osm", "google", "demo"]),
  name: z.string().trim().min(1).max(200),
  category: str(120),
  address: str(300),
  city: str(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: str(60),
  email: z.string().trim().max(200).nullish().transform((v) => (v && z.email().safeParse(v).success ? v : null)),
  website: z.string().trim().max(500).nullish().transform((v) => (v && /^https?:\/\//i.test(v) ? v : null)),
  openingHours: str(1000),
  rating: z.number().min(0).max(5).nullish().transform((v) => v ?? null),
  reviewsCount: z.number().int().min(0).nullish().transform((v) => v ?? null),
  distanceKm: z.number().min(0).optional(),
});

export const ImportBody = z.object({
  results: z.array(SearchResultSchema).min(1, "Seleziona almeno un'attività").max(MAX_RESULTS, `Puoi salvare al massimo ${MAX_RESULTS} attività per volta`),
});
