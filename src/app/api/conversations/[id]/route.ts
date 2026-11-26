import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toMessageView } from "@/lib/ai/messages";

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  return db.conversation.findFirst({ where: { id, userId }, select: { id: true, title: true, leadId: true, updatedAt: true } });
}

/** GET /api/conversations/[id] → { conversation, lead, messages: ChatMessageView[] } */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const c = await own(user.id, id);
  if (!c) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
  const [messages, lead] = await Promise.all([
    db.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: "asc" } }),
    c.leadId ? db.lead.findFirst({ where: { id: c.leadId, userId: user.id }, select: { id: true, name: true, category: true, city: true } }) : null,
  ]);
  return NextResponse.json({
    conversation: { ...c, updatedAt: c.updatedAt.toISOString() },
    lead,
    messages: messages.map(toMessageView),
  });
}

const Patch = z.object({ title: z.string().trim().min(1, "Il titolo non può essere vuoto").max(120) });

/** PATCH /api/conversations/[id] — body { title } */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const res = await db.conversation.updateMany({ where: { id, userId: user.id }, data: { title: parsed.data.title } });
  if (!res.count) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/conversations/[id] */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const res = await db.conversation.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
