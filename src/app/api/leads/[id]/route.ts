import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { bad, notFound, parseBody } from "@/lib/crm/api";
import { LeadPatch } from "@/lib/crm/schemas";
import { getLead, toActivityDTO, toLeadDTO, updateLead } from "@/lib/crm/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const lead = await db.lead.findFirst({ where: { id, userId: user.id }, include: { activities: { orderBy: { createdAt: "desc" } } } });
  if (!lead) return notFound();
  const { activities, ...rest } = lead;
  return NextResponse.json({ lead: toLeadDTO(rest), activities: activities.map(toActivityDTO) });
}

/** PATCH parziale. Se cambia `stage` registra un'attività "stage"; con stage=lost accetta `lostReason`. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const body = await parseBody(req, LeadPatch);
  if (body instanceof NextResponse) return body;
  if (Object.keys(body).length === 0) return bad("Nessun campo da aggiornare");
  const lead = await updateLead(user.id, id, body);
  if (!lead) return notFound();
  return NextResponse.json({ lead: toLeadDTO(lead) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!(await getLead(user.id, id))) return notFound();
  await db.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
