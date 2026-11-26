import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { scoreLeads } from "@/lib/ai/score";
import { ScoreRequestSchema } from "@/lib/ai/schemas";
import { isAiDemo } from "@/lib/ai";
import { aiRateLimit } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { chargeForAi, creditCost, refundCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/ai/score — body { leadIds: string[] } (max 50, solo lead dell'utente).
 * Risposta: { results: [{ leadId, score, summary }], errors?: [{ leadId, error }], demo }
 * Con l'AI reale costa CREDIT_COST_SCORE crediti per lead (addebitati prima, rimborsati per i lead non valutati);
 * senza crediti sufficienti risponde 402.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = ScoreRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });

  const demo = isAiDemo();
  const limited = aiRateLimit(user.id, "score", demo);
  if (limited) return limited;

  // Si addebitano solo i lead che esistono e appartengono all'utente.
  const ids = [...new Set(parsed.data.leadIds)];
  const billable = demo ? 0 : await db.lead.count({ where: { userId: user.id, id: { in: ids } } });
  const charge = await chargeForAi(user.id, "score", billable, demo);
  if (charge instanceof NextResponse) return charge;

  let out;
  try {
    out = await scoreLeads(user, ids);
  } catch (err) {
    await refundCredits(user.id, charge.charged);
    throw err;
  }
  if (charge.charged) {
    const failed = Math.max(0, billable - out.results.length);
    await refundCredits(user.id, failed * creditCost("score"));
  }
  if (!out.results.length && out.errors?.length) {
    const notFound = out.errors.every((e) => e.error === "Cliente non trovato");
    return NextResponse.json({ ...out, error: notFound ? "Cliente non trovato" : out.errors[0].error }, { status: notFound ? 404 : 502 });
  }
  return NextResponse.json(out);
}
