import "server-only";
// Punteggio AI: Haiku 5.5 con output strutturato (o euristica deterministica in modalità demo).
// Il modello assegna i sotto-punteggi per dimensione; il totale è la media pesata con i pesi dell'agente,
// calcolata qui (così cambiare i pesi ricalcola i totali senza richiamare l'AI).
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { db } from "@/lib/db";
import { MODEL_FAST, anthropic, isAiDemo } from "@/lib/ai";
import { RefusalError, aiErrorMessage, mapWithConcurrency } from "./client";
import { demoScore } from "./demo";
import { inTerritory, leadToText, type SellerProfile } from "./lead-context";
import { scoreSystemPrompt, scoreUserPrompt } from "./prompts";
import { ScoreOutputSchema, researchOf, researchToText, type ScoreOutput, type ScoreReason, type ScoreResponse } from "./schemas";
import { DIMENSION_IDS, clampScore, parseScoreBreakdown, parseWeights, weightedScore, type ScoreBreakdown, type ScoreWeights } from "./scoring";

const CONCURRENCY = 5;

export type ScoringUser = SellerProfile & { id: string; scoringCriteria?: string | null; scoringWeights?: string | null };

type LeadWithActivities = NonNullable<Awaited<ReturnType<typeof loadLeads>>>[number];

function loadLeads(userId: string, ids: string[]) {
  return db.lead.findMany({
    where: { userId, id: { in: ids } },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 8, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
  });
}

async function scoreWithClaude(lead: LeadWithActivities, seller: ScoringUser): Promise<ScoreOutput> {
  const terr = inTerritory(lead, seller.territory);
  const hint =
    terr === true ? "Nota: la sede del cliente risulta nel territorio dell'agente."
    : terr === false ? "Nota: la sede del cliente sembra fuori dal territorio dichiarato dall'agente."
    : "Nota: non è possibile stabilire con certezza se il cliente è nel territorio dell'agente.";
  const research = researchOf(lead.briefing);
  const res = await anthropic().messages.parse({
    model: MODEL_FAST,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ScoreOutputSchema) },
    system: scoreSystemPrompt(seller),
    messages: [{ role: "user", content: scoreUserPrompt(leadToText(lead, lead.activities), hint, research ? researchToText(research) : null) }],
  });
  if (res.stop_reason === "refusal") throw new RefusalError("Valutazione non disponibile per questo cliente.");
  if (!res.parsed_output) throw new Error(`Output non valido (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

/** Normalizza l'output (sotto-punteggi 0-100, testi ripuliti) e calcola il totale con i pesi. */
export function finalizeScore(out: ScoreOutput, weights: ScoreWeights, demo: boolean) {
  const dimensions = Object.fromEntries(
    DIMENSION_IDS.map((id) => [id, { score: clampScore(out.dimensions[id].score), reason: out.dimensions[id].reason.replace(/\s+/g, " ").trim() }]),
  ) as ScoreBreakdown["dimensions"];
  const breakdown: ScoreBreakdown = { v: 1, dimensions, confidence: out.confidence };
  const reason: ScoreReason = { summary: out.summary.trim(), factors: out.factors.slice(0, 6), ...(demo && { demo: true }) };
  return { score: weightedScore(dimensions, weights), breakdown, reason };
}

/** Calcola e salva il punteggio dei lead indicati (solo quelli dell'utente). */
export async function scoreLeads(user: ScoringUser, leadIds: string[]): Promise<ScoreResponse> {
  const ids = [...new Set(leadIds)];
  const leads = await loadLeads(user.id, ids);
  const demo = isAiDemo();
  const weights = parseWeights(user.scoringWeights);
  const errors: { leadId: string; error: string }[] = [];
  const found = new Set(leads.map((l) => l.id));
  for (const id of ids) if (!found.has(id)) errors.push({ leadId: id, error: "Cliente non trovato" });

  const scored = await mapWithConcurrency(leads, CONCURRENCY, async (lead) => {
    try {
      const out = demo ? demoScore(lead, user, lead.activities) : await scoreWithClaude(lead, user);
      const { score, breakdown, reason } = finalizeScore(out, weights, demo);
      await db.lead.updateMany({
        where: { id: lead.id, userId: user.id },
        data: { score, scoreReason: JSON.stringify(reason), scoreBreakdown: JSON.stringify(breakdown), scoredAt: new Date() },
      });
      return { leadId: lead.id, score, summary: reason.summary, breakdown };
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

/**
 * Ricalcola i totali di tutti i lead dell'utente che hanno i sotto-punteggi, con i nuovi pesi (nessuna chiamata AI).
 * Raggruppa i lead per nuovo punteggio: al massimo 101 UPDATE in una transazione.
 */
export async function recomputeTotals(userId: string, weights: ScoreWeights): Promise<number> {
  const rows = await db.lead.findMany({ where: { userId, scoreBreakdown: { not: null } }, select: { id: true, score: true, scoreBreakdown: true } });
  const groups = new Map<number, string[]>();
  for (const r of rows) {
    const b = parseScoreBreakdown(r.scoreBreakdown);
    if (!b) continue;
    const s = weightedScore(b.dimensions, weights);
    if (s === r.score) continue;
    groups.set(s, [...(groups.get(s) ?? []), r.id]);
  }
  if (!groups.size) return 0;
  await db.$transaction([...groups].map(([score, ids]) => db.lead.updateMany({ where: { userId, id: { in: ids } }, data: { score } })));
  return [...groups.values()].reduce((n, ids) => n + ids.length, 0);
}
