import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { recomputeTotals } from "@/lib/ai/score";
import { DIMENSION_IDS, MAX_WEIGHT, normalizeWeights } from "@/lib/ai/scoring";

const Weight = z.number().int().min(0).max(MAX_WEIGHT);
const Body = z.object({
  criteria: z.string().trim().max(1500, "Testo troppo lungo (max 1500 caratteri)").optional().transform((v) => (v ? v : null)),
  weights: z.object(Object.fromEntries(DIMENSION_IDS.map((id) => [id, Weight])) as Record<(typeof DIMENSION_IDS)[number], typeof Weight>),
});

/**
 * PUT /api/profile/scoring — body { criteria?, weights: { fit, size, reputation, presence, proximity, data } } (pesi 0-5).
 * Salva i criteri di valutazione e i pesi, poi ricalcola subito i totali dei clienti già valutati (senza chiamare l'AI).
 * Risposta: { ok, updated } con il numero di punteggi cambiati.
 */
export async function PUT(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const weights = normalizeWeights(parsed.data.weights);
  await db.user.update({ where: { id: user.id }, data: { scoringCriteria: parsed.data.criteria, scoringWeights: JSON.stringify(weights) } });
  const updated = await recomputeTotals(user.id, weights);
  return NextResponse.json({ ok: true, updated, weights });
}
