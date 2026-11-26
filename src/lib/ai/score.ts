import "server-only";
// Lead score: Haiku 5.5 con output strutturato (o euristica deterministica in modalità demo).
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { db } from "@/lib/db";
import { MODEL_FAST, anthropic, isAiDemo } from "@/lib/ai";
import { RefusalError, aiErrorMessage, mapWithConcurrency } from "./client";
import { demoScore } from "./demo";
import { inTerritory, leadToText, type SellerProfile } from "./lead-context";
import { scoreSystemPrompt, scoreUserPrompt } from "./prompts";
import { ScoreOutputSchema, type ScoreOutput, type ScoreReason, type ScoreResponse } from "./schemas";

const CONCURRENCY = 5;

type LeadWithActivities = NonNullable<Awaited<ReturnType<typeof loadLeads>>>[number];

function loadLeads(userId: string, ids: string[]) {
  return db.lead.findMany({
    where: { userId, id: { in: ids } },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 8, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
  });
}

async function scoreWithClaude(lead: LeadWithActivities, seller: SellerProfile): Promise<ScoreOutput> {
  const terr = inTerritory(lead, seller.territory);
  const hint =
    terr === true ? "Nota: la sede del lead risulta nel territorio dell'agente."
    : terr === false ? "Nota: la sede del lead sembra fuori dal territorio dichiarato dall'agente."
    : "Nota: non è possibile stabilire con certezza se il lead è nel territorio dell'agente.";
  const res = await anthropic().messages.parse({
    model: MODEL_FAST,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ScoreOutputSchema) },
    system: scoreSystemPrompt(seller),
    messages: [{ role: "user", content: scoreUserPrompt(leadToText(lead, lead.activities), hint) }],
  });
  if (res.stop_reason === "refusal") throw new RefusalError("Valutazione non disponibile per questo cliente.");
  if (!res.parsed_output) throw new Error(`Output non valido (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

/** Calcola e salva il punteggio dei lead indicati (solo quelli dell'utente). */
export async function scoreLeads(user: SellerProfile & { id: string }, leadIds: string[]): Promise<ScoreResponse> {
  const ids = [...new Set(leadIds)];
  const leads = await loadLeads(user.id, ids);
  const demo = isAiDemo();
  const errors: { leadId: string; error: string }[] = [];
  const found = new Set(leads.map((l) => l.id));
  for (const id of ids) if (!found.has(id)) errors.push({ leadId: id, error: "Cliente non trovato" });

  const scored = await mapWithConcurrency(leads, CONCURRENCY, async (lead) => {
    try {
      const out = demo ? demoScore(lead, user, lead.activities) : await scoreWithClaude(lead, user);
      const score = Math.max(0, Math.min(100, Math.round(out.score)));
      const reason: ScoreReason = { summary: out.summary.trim(), factors: out.factors.slice(0, 6), ...(demo && { demo: true }) };
      await db.lead.updateMany({
        where: { id: lead.id, userId: user.id },
        data: { score, scoreReason: JSON.stringify(reason), scoredAt: new Date() },
      });
      return { leadId: lead.id, score, summary: reason.summary };
    } catch (err) {
      console.error("[ai/score]", lead.id, err);
      errors.push({ leadId: lead.id, error: aiErrorMessage(err) });
      return null;
    }
  });

  return {
    results: scored.filter((r): r is NonNullable<typeof r> => r !== null),
    ...(errors.length && { errors }),
    demo,
  };
}
