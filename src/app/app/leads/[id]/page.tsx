import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScorePanel } from "@/components/ai/score-panel";
import { BriefingPanel } from "@/components/ai/briefing-panel";
import { AskAssistantCard, LeadHeader, LeadInfoCard, LeadSideInfo } from "@/components/crm/lead-detail";
import { Timeline } from "@/components/crm/timeline";
import { toActivityDTO, toLeadDTO } from "@/lib/crm/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await db.lead.findFirst({ where: { id, userId: user.id }, select: { name: true } });
  return { title: lead?.name ?? "Cliente" };
}

export default async function LeadPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const row = await db.lead.findFirst({ where: { id, userId: user.id }, include: { activities: { orderBy: { createdAt: "desc" } } } });
  if (!row) notFound();
  const { activities, ...rest } = row;
  const lead = toLeadDTO(rest);

  return (
    <div>
      <LeadHeader lead={lead} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <LeadInfoCard lead={lead} />
          <Timeline leadId={lead.id} activities={activities.map(toActivityDTO)} />
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Intelligenza artificiale">
          <ScorePanel leadId={lead.id} score={lead.score} scoreReason={lead.scoreReason} scoredAt={lead.scoredAt} />
          <BriefingPanel leadId={lead.id} initialBriefing={lead.briefing} briefingAt={lead.briefingAt} />
          <AskAssistantCard leadId={lead.id} name={lead.name} />
          <LeadSideInfo lead={lead} />
        </aside>
      </div>
    </div>
  );
}
