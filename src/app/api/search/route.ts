import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { searchPlaces, SearchError } from "@/lib/search";
import { rateLimit } from "@/lib/search/rate-limit";
import { SearchBody } from "@/lib/search/schema";
import { dedupeRecent } from "@/lib/search/recent";
import type { SearchResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/** Esegue una ricerca di attività e la salva nello storico. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const limit = rateLimit(`search:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Hai fatto molte ricerche in poco tempo. Riprova tra ${limit.retryAfterSec} secondi.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const parsed = SearchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const params = parsed.data;

  let outcome;
  try {
    outcome = await searchPlaces(params);
  } catch (err) {
    if (err instanceof SearchError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/search]", err);
    return NextResponse.json({ error: "La ricerca non è riuscita. Riprova tra qualche istante." }, { status: 502 });
  }

  // Stato nel CRM: match su userId + source + sourceId
  const bySource = new Map<string, string[]>();
  for (const r of outcome.results) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r.sourceId]);
  const existing = bySource.size
    ? await db.lead.findMany({
        where: { userId: user.id, OR: [...bySource].map(([source, ids]) => ({ source, sourceId: { in: ids } })) },
        select: { id: true, source: true, sourceId: true },
      })
    : [];
  const leadByKey = new Map(existing.map((l) => [`${l.source}|${l.sourceId}`, l.id]));

  const saved = await db.savedSearch.create({
    data: { userId: user.id, query: params.query, location: params.location, radiusKm: params.radiusKm, results: outcome.results.length },
  });

  const body: SearchResponse = {
    searchId: saved.id,
    provider: outcome.provider,
    demo: outcome.provider === "demo",
    notice: outcome.notice,
    center: outcome.center,
    query: params.query,
    location: params.location,
    radiusKm: params.radiusKm,
    results: outcome.results.map((r) => {
      const leadId = leadByKey.get(`${r.source}|${r.sourceId}`) ?? null;
      return { ...r, alreadySaved: leadId !== null, leadId };
    }),
  };
  return NextResponse.json(body);
}

/** Ultime 10 ricerche distinte dell'utente. */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const rows = await db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const searches = dedupeRecent(rows);
  return NextResponse.json({ searches });
}
