import Link from "next/link";
import { KanbanSquare, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { NewLeadButton } from "@/components/crm/new-lead-dialog";
import { formatEuro } from "@/lib/utils";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const user = await requireUser();
  const cards = await db.lead.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, city: true, category: true, score: true, value: true, nextFollowUp: true, stage: true, position: true },
  });
  const open = cards.filter((c) => c.stage !== "won" && c.stage !== "lost");
  const openValue = open.reduce((a, c) => a + (c.value ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={cards.length ? `${open.length} trattative aperte · ${formatEuro(openValue)} di valore potenziale` : "Trascina i clienti da una fase all'altra."}
        actions={cards.length ? <NewLeadButton variant="outline" /> : undefined}
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-5 w-5" />}
          title="La tua pipeline è vuota"
          description="Aggiungi i primi clienti per seguirli fase per fase, dal primo contatto alla firma."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/app/search"><Button variant="secondary"><Search className="h-4 w-4" />Trova clienti</Button></Link>
              <NewLeadButton variant="outline" />
            </div>
          }
        />
      ) : (
        <PipelineBoard cards={cards.map((c) => ({ ...c, nextFollowUp: c.nextFollowUp?.toISOString() ?? null }))} />
      )}
    </div>
  );
}
