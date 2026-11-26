import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { LeadsView } from "@/components/crm/leads-view";
import { NewLeadButton } from "@/components/crm/new-lead-dialog";
import { LeadQuery, parseLeadQuery } from "@/lib/crm/schemas";
import { listLeads, userTags } from "@/lib/crm/server";

export const metadata = { title: "Clienti" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const parsed = parseLeadQuery(await searchParams);
  const query = parsed.success ? parsed.data : LeadQuery.parse({});
  const [result, tags, anyLead] = await Promise.all([
    listLeads(user.id, query),
    userTags(user.id),
    db.lead.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);
  return (
    <div>
      <PageHeader
        title="Clienti"
        description="Tutti i tuoi clienti e potenziali clienti, in un unico posto."
        actions={anyLead ? <NewLeadButton /> : undefined}
      />
      <LeadsView
        leads={result.leads}
        total={result.total}
        pages={result.pages}
        tags={tags}
        hasAnyLead={Boolean(anyLead)}
        query={{ q: query.q, stage: query.stage, minScore: query.minScore, tag: query.tag, sort: query.sort, page: query.page }}
      />
    </div>
  );
}
