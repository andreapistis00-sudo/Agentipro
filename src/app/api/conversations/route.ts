import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import type { ConversationSummary } from "@/lib/ai/schemas";

/** GET /api/conversations?leadId= — elenco conversazioni dell'utente (più recenti prima). */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const leadId = new URL(req.url).searchParams.get("leadId");
  const rows = await db.conversation.findMany({
    where: { userId: user.id, ...(leadId && { leadId }) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, leadId: true, updatedAt: true },
  });
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter((x): x is string => Boolean(x)))];
  const leads = leadIds.length
    ? await db.lead.findMany({ where: { userId: user.id, id: { in: leadIds } }, select: { id: true, name: true } })
    : [];
  const byId = new Map(leads.map((l) => [l.id, l]));
  const conversations: ConversationSummary[] = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
    lead: r.leadId ? byId.get(r.leadId) ?? null : null,
  }));
  return NextResponse.json({ conversations });
}

const Body = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  leadId: z.string().min(1).max(64).optional(),
});

/** POST /api/conversations — body { title?, leadId? } → { conversation } */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  if (parsed.data.leadId) {
    const lead = await db.lead.findFirst({ where: { id: parsed.data.leadId, userId: user.id }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  const c = await db.conversation.create({
    data: { userId: user.id, leadId: parsed.data.leadId ?? null, ...(parsed.data.title && { title: parsed.data.title }) },
    select: { id: true, title: true, leadId: true, updatedAt: true },
  });
  return NextResponse.json({ conversation: { ...c, updatedAt: c.updatedAt.toISOString() } }, { status: 201 });
}
