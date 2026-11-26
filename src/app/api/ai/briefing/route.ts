import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { generateBriefing, loadLeadForBriefing } from "@/lib/ai/briefing";
import { isAiDemo } from "@/lib/ai";
import { aiErrorMessage, aiRateLimit, ndjsonResponse } from "@/lib/ai/client";
import { BriefingRequestSchema, type BriefingEvent } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/ai/briefing — body { leadId }.
 * Risposta: stream NDJSON di BriefingEvent (status → source* → done | error).
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = BriefingRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "leadId mancante" }, { status: 400 });
  const lead = await loadLeadForBriefing(user.id, parsed.data.leadId);
  if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const limited = aiRateLimit(user.id, "briefing", isAiDemo());
  if (limited) return limited;

  return ndjsonResponse<BriefingEvent>(
    (send, signal) => generateBriefing(user, lead, send, signal),
    (err) => ({ type: "error", message: aiErrorMessage(err) }),
  );
}
