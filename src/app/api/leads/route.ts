import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { bad, parseBody } from "@/lib/crm/api";
import { serializeTags } from "@/lib/crm/format";
import { BulkLeads, BulkPatch, LeadCreate, parseLeadQuery, zodError } from "@/lib/crm/schemas";
import { bulkSetStage, listLeads, toLeadDTO } from "@/lib/crm/server";

/** GET /api/leads?q=&stage=&minScore=&tag=&sort=score|updated|name|followup|value|created&page=&pageSize= */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const q = parseLeadQuery(new URL(req.url).searchParams);
  if (!q.success) return bad(`Parametri di ricerca non validi (${zodError(q.error)})`);
  return NextResponse.json(await listLeads(user.id, q.data));
}

/** POST /api/leads — creazione manuale. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const body = await parseBody(req, LeadCreate);
  if (body instanceof NextResponse) return body;
  const { tags, stage = "new", ...rest } = body;
  const first = await db.lead.findFirst({ where: { userId: user.id, stage }, orderBy: { position: "asc" }, select: { position: true } });
  const lead = await db.lead.create({
    data: { ...rest, stage, userId: user.id, source: "manual", tags: serializeTags(tags), position: first ? first.position - 1 : 0, lostReason: stage === "lost" ? rest.lostReason : null },
  });
  return NextResponse.json({ lead: toLeadDTO(lead) }, { status: 201 });
}

/** PATCH /api/leads — azione di massa: { ids, stage, lostReason? }. */
export async function PATCH(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const body = await parseBody(req, BulkPatch);
  if (body instanceof NextResponse) return body;
  return NextResponse.json(await bulkSetStage(user.id, body.ids, body.stage, body.lostReason));
}

/** DELETE /api/leads — eliminazione di massa: { ids }. */
export async function DELETE(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const body = await parseBody(req, BulkLeads);
  if (body instanceof NextResponse) return body;
  const { count } = await db.lead.deleteMany({ where: { userId: user.id, id: { in: body.ids } } });
  return NextResponse.json({ deleted: count });
}
