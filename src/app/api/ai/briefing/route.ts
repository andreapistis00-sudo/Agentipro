import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { generateResearch, loadLeadForResearch } from "@/lib/ai/research";
import { isAiDemo } from "@/lib/ai";
import { aiErrorMessage, aiRateLimit, ndjsonResponse } from "@/lib/ai/client";
import { ResearchRequestSchema, type ResearchEvent } from "@/lib/ai/schemas";
import { chargeForAi, refundCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/ai/briefing — body { leadId }. Compila la Scheda AI del cliente (ricerca di informazioni pubbliche).
 * Il percorso resta "briefing" per compatibilità; il risultato è salvato in `Lead.briefing` (formato v2).
 * Risposta: stream NDJSON di ResearchEvent (status → source* → done | error).
 * Con l'AI reale costa CREDIT_COST_BRIEFING crediti, addebitati prima di aprire lo stream (402 se non bastano)
 * e rimborsati se la generazione fallisce per un errore.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = ResearchRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "leadId mancante" }, { status: 400 });
  const lead = await loadLeadForResearch(user.id, parsed.data.leadId);
  if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const demo = isAiDemo();
  const limited = aiRateLimit(user.id, "briefing", demo);
  if (limited) return limited;
  const charge = await chargeForAi(user.id, "briefing", 1, demo);
  if (charge instanceof NextResponse) return charge;

  return ndjsonResponse<ResearchEvent>(
    async (send, signal) => {
      try {
        await generateResearch(user, lead, send, signal);
      } catch (err) {
        if (!signal.aborted) await refundCredits(user.id, charge.charged);
        throw err;
      }
    },
    (err) => ({ type: "error", message: aiErrorMessage(err) }),
  );
}
