import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SearchView } from "@/components/search/search-view";
import { dedupeRecent } from "@/lib/search/recent";

export const metadata = { title: "Trova clienti" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; l?: string; r?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const rows = await db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });

  const recent = dedupeRecent(rows);

  const radius = Number(sp.r);
  const initialQuery = sp.q && sp.l
    ? { q: sp.q.slice(0, 80), l: sp.l.slice(0, 120), r: Number.isFinite(radius) && radius >= 0.5 && radius <= 50 ? radius : 5 }
    : null;

  return (
    <div>
      <PageHeader title="Trova clienti" description="Cerca attività reali per tipo e zona, poi salvale nel CRM con un clic." />
      <SearchView initialRecent={recent} defaultLocation={user.territory ?? ""} initialQuery={initialQuery} />
    </div>
  );
}
