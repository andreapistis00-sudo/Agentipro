import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, DIMENSION_IDS, breakdownTitle, parseScoreBreakdown, parseWeights, weightedScore, type ScoreWeights } from "../scoring";

const dims = (v: Partial<Record<string, number>>) =>
  Object.fromEntries(DIMENSION_IDS.map((id) => [id, { score: v[id] ?? 50, reason: "x" }])) as Record<(typeof DIMENSION_IDS)[number], { score: number; reason: string }>;
const zero: ScoreWeights = { fit: 0, size: 0, reputation: 0, presence: 0, proximity: 0, data: 0 };

describe("media pesata del punteggio", () => {
  it("con i pesi predefiniti è la media pesata arrotondata", () => {
    // (97·5 + 85·3 + 88·3 + 82·2 + 96·3 + 90·1) / 17 = 90,9
    expect(weightedScore(dims({ fit: 97, size: 85, reputation: 88, presence: 82, proximity: 96, data: 90 }), DEFAULT_WEIGHTS)).toBe(91);
  });

  it("cambiare i pesi cambia il totale senza toccare i sotto-punteggi", () => {
    const d = dims({ fit: 100, proximity: 0 });
    expect(weightedScore(d, { ...zero, fit: 1 })).toBe(100);
    expect(weightedScore(d, { ...zero, proximity: 1 })).toBe(0);
    expect(weightedScore(d, { ...zero, fit: 1, proximity: 1 })).toBe(50);
  });

  it("con tutti i pesi a zero usa la media semplice e limita a 0-100", () => {
    expect(weightedScore(dims({ fit: 100, size: 100, reputation: 100, presence: 100, proximity: 100, data: 40 }), zero)).toBe(90);
    expect(weightedScore(dims({ fit: 180, size: -20 }), { ...zero, fit: 1, size: 1 })).toBe(50);
  });
});

describe("pesi e breakdown salvati", () => {
  it("parseWeights tollera JSON assente, malformato o fuori scala", () => {
    expect(parseWeights(null)).toEqual(DEFAULT_WEIGHTS);
    expect(parseWeights("{rotto")).toEqual(DEFAULT_WEIGHTS);
    expect(parseWeights(JSON.stringify({ fit: 9, size: -1, data: 2.6, other: 3 }))).toEqual({ ...DEFAULT_WEIGHTS, fit: 5, size: 0, data: 3 });
  });

  it("parseScoreBreakdown valida la struttura", () => {
    const ok = JSON.stringify({ v: 1, confidence: "alta", dimensions: dims({ fit: 80 }) });
    expect(parseScoreBreakdown(ok)?.dimensions.fit.score).toBe(80);
    expect(parseScoreBreakdown(JSON.stringify({ confidence: "alta" }))).toBeNull();
    expect(parseScoreBreakdown("x")).toBeNull();
    expect(breakdownTitle(parseScoreBreakdown(ok)!)).toContain("Aderenza: 80");
  });
});
