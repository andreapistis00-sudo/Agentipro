// Punteggio AI per dimensioni: definizioni, pesi dell'agente e media pesata calcolata in codice.
// Modulo puro, sicuro sia lato server sia lato client.
import { z } from "zod";

export const SCORE_DIMENSIONS = [
  { id: "fit", label: "Aderenza", hint: "Quanto corrisponde al tuo cliente ideale e a ciò che vendi" },
  { id: "size", label: "Dimensione", hint: "Dimensione e volume d'attività stimati" },
  { id: "reputation", label: "Reputazione", hint: "Recensioni e valutazioni pubbliche" },
  { id: "presence", label: "Presenza online", hint: "Sito, social e reperibilità dei contatti" },
  { id: "proximity", label: "Vicinanza", hint: "Posizione rispetto al tuo territorio" },
  { id: "data", label: "Completezza dati", hint: "Quante informazioni sono disponibili sul cliente" },
] as const;

export type DimensionId = (typeof SCORE_DIMENSIONS)[number]["id"];
export const DIMENSION_IDS = SCORE_DIMENSIONS.map((d) => d.id) as DimensionId[];
export type ScoreWeights = Record<DimensionId, number>;

/** Pesi predefiniti (0-5): conta di più l'aderenza al cliente ideale. */
export const DEFAULT_WEIGHTS: ScoreWeights = { fit: 5, size: 3, reputation: 3, presence: 2, proximity: 3, data: 1 };
export const MAX_WEIGHT = 5;

export const ConfidenceSchema = z.enum(["alta", "media", "bassa"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const DimensionScoreSchema = z.object({ score: z.number(), reason: z.string() });
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;
export type Dimensions = Record<DimensionId, DimensionScore>;

/** Contenuto di `Lead.scoreBreakdown`. */
export const ScoreBreakdownSchema = z.object({
  v: z.literal(1).default(1),
  dimensions: z.object({
    fit: DimensionScoreSchema, size: DimensionScoreSchema, reputation: DimensionScoreSchema,
    presence: DimensionScoreSchema, proximity: DimensionScoreSchema, data: DimensionScoreSchema,
  }),
  confidence: ConfidenceSchema,
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const clampScore = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0);

/** Pesi salvati in `User.scoringWeights` (JSON). Valori mancanti o non validi → predefiniti; limitati a 0-5 interi. */
export function parseWeights(raw: string | null | undefined): ScoreWeights {
  let obj: Record<string, unknown> = {};
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object") obj = v as Record<string, unknown>;
    } catch {
      /* JSON non valido: predefiniti */
    }
  }
  return normalizeWeights(obj);
}

export function normalizeWeights(obj: Partial<Record<string, unknown>>): ScoreWeights {
  const out = { ...DEFAULT_WEIGHTS };
  for (const id of DIMENSION_IDS) {
    const n = Number(obj[id]);
    if (obj[id] != null && Number.isFinite(n)) out[id] = Math.max(0, Math.min(MAX_WEIGHT, Math.round(n)));
  }
  return out;
}

/** Totale 0-100 = media dei sotto-punteggi pesata con i pesi dell'agente. Con tutti i pesi a 0 vale la media semplice. */
export function weightedScore(dims: Record<DimensionId, { score: number }>, weights: ScoreWeights): number {
  let sum = 0;
  let tot = 0;
  for (const id of DIMENSION_IDS) {
    sum += clampScore(dims[id].score) * weights[id];
    tot += weights[id];
  }
  if (tot === 0) return clampScore(DIMENSION_IDS.reduce((s, id) => s + clampScore(dims[id].score), 0) / DIMENSION_IDS.length);
  return clampScore(sum / tot);
}

export function parseScoreBreakdown(raw: string | null | undefined): ScoreBreakdown | null {
  if (!raw) return null;
  try {
    const p = ScoreBreakdownSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

/** Riepilogo testuale delle dimensioni (tooltip della lista clienti). */
export function breakdownTitle(b: ScoreBreakdown) {
  return SCORE_DIMENSIONS.map((d) => `${d.label}: ${clampScore(b.dimensions[d.id].score)}`).join(" · ");
}
