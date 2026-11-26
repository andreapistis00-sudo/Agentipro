// TEMPORANEO: anteprima dei pannelli AI (da eliminare).
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BriefingPanel } from "@/components/ai/briefing-panel";
import { ScorePanel } from "@/components/ai/score-panel";

export default async function Preview({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id } = await searchParams;
  const lead = await db.lead.findFirst({ where: { userId: user.id, ...(id && { id }) }, orderBy: { createdAt: "asc" } });
  if (!lead) return <p>Nessun lead</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0"><BriefingPanel leadId={lead.id} initialBriefing={lead.briefing} briefingAt={lead.briefingAt?.toISOString() ?? null} /></div>
      <div><ScorePanel leadId={lead.id} score={lead.score} scoreReason={lead.scoreReason} scoredAt={lead.scoredAt?.toISOString() ?? null} /></div>
    </div>
  );
}
