import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { generateBriefing, loadLeadForBriefing } from "@/lib/ai/briefing";
import { isAiDemo } from "@/lib/ai";
import { aiErrorMessage, aiRateLimit, ndjsonResponse } from "@/lib/ai/client";
import { BriefingRequestSchema, type BriefingEvent } from "@/lib/ai/schemas";
import { chargeForAi, refundCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/ai/briefing — body { leadId }.
 * Risposta: stream NDJSON di BriefingEvent (status → source* → done | error).
 * Con l'AI reale costa CREDIT_COST_BRIEFING crediti, addebitati prima di aprire lo stream (402 se non bastano)
 * e rimborsati se la generazione fallisce per un errore.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = BriefingRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "leadId mancante" }, { status: 400 });
  const lead = await loadLeadForBriefing(user.id, parsed.data.leadId);
  if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const demo = isAiDemo();
  const limited = aiRateLimit(user.id, "briefing", demo);
  if (limited) return limited;
  const charge = await chargeForAi(user.id, "briefing", 1, demo);
  if (charge instanceof NextResponse) return charge;

  return ndjsonResponse<BriefingEvent>(
    async (send, signal) => {
      try {
        await generateBriefing(user, lead, send, signal);
      } catch (err) {
        if (!signal.aborted) await refundCredits(user.id, charge.charged);
        throw err;
      }
    },
    (err) => ({ type: "error", message: aiErrorMessage(err) }),
  );
}
