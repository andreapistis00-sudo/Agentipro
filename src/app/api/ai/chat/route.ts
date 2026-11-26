import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import { runChat, userRaw } from "@/lib/ai/chat";
import { aiErrorMessage, ndjsonResponse } from "@/lib/ai/client";
import { ChatRequestSchema, type ChatEvent } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/ai/chat — body { conversationId?, message, leadId? }.
 * Senza conversationId crea una nuova conversazione (legata a leadId se indicato).
 * Risposta: stream NDJSON di ChatEvent: start → (status | action | source | delta | title)* → done | error.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = ChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const { conversationId, message, leadId } = parsed.data;

  let conversation;
  let isNew = false;
  if (conversationId) {
    conversation = await db.conversation.findFirst({ where: { id: conversationId, userId: user.id } });
    if (!conversation) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
  } else {
    if (leadId) {
      const lead = await db.lead.findFirst({ where: { id: leadId, userId: user.id }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
    }
    conversation = await db.conversation.create({ data: { userId: user.id, leadId: leadId ?? null } });
    isNew = true;
  }

  const userMsg = await db.message.create({
    data: { conversationId: conversation.id, role: "user", content: message, raw: userRaw(message) },
    select: { id: true },
  });
  const conv = conversation;

  return ndjsonResponse<ChatEvent>(
    async (send, signal) => {
      send({ type: "start", conversationId: conv.id, title: conv.title, demo: isAiDemo() });
      await runChat({ user, conversation: conv, isNew, message, emit: send, signal }, userMsg.id);
    },
    (err) => ({ type: "error", message: aiErrorMessage(err) }),
  );
}
