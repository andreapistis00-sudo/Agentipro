import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { ImportBody } from "@/lib/search/schema";
import type { ImportResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/** Salva nel CRM le attività selezionate dai risultati di ricerca (senza duplicati). */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const parsed = ImportBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });

  // Deduplica la richiesta stessa
  const unique = [...new Map(parsed.data.results.map((r) => [`${r.source}|${r.sourceId}`, r])).values()];

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.lead.findMany({
        where: { userId: user.id, OR: unique.map((r) => ({ source: r.source, sourceId: r.sourceId })) },
        select: { id: true, source: true, sourceId: true },
      });
      const existingKeys = new Set(existing.map((l) => `${l.source}|${l.sourceId}`));
      const last = await tx.lead.aggregate({ where: { userId: user.id, stage: "new" }, _max: { position: true } });
      let position = (last._max.position ?? -1) + 1;

      const leads: ImportResponse["leads"] = existing.map((l) => ({ id: l.id, sourceId: l.sourceId ?? "" }));
      let created = 0;
      for (const r of unique) {
        if (existingKeys.has(`${r.source}|${r.sourceId}`)) continue;
        const data = {
          name: r.name, category: r.category, address: r.address, city: r.city, lat: r.lat, lng: r.lng,
          phone: r.phone, email: r.email, website: r.website, openingHours: r.openingHours,
          rating: r.rating, reviewsCount: r.reviewsCount,
        };
        const lead = await tx.lead.upsert({
          where: { userId_source_sourceId: { userId: user.id, source: r.source, sourceId: r.sourceId } },
          create: { ...data, userId: user.id, source: r.source, sourceId: r.sourceId, stage: "new", position: position++ },
          update: {},
          select: { id: true, sourceId: true },
        });
        leads.push({ id: lead.id, sourceId: lead.sourceId ?? r.sourceId });
        created++;
      }
      return { created, skipped: parsed.data.results.length - created, leads };
    });
    return NextResponse.json(result satisfies ImportResponse, { status: result.created ? 201 : 200 });
  } catch (err) {
    console.error("[api/leads/import]", err);
    return NextResponse.json({ error: "Non è stato possibile salvare i contatti. Riprova." }, { status: 500 });
  }
}
