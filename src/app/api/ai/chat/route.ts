import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import { runChat, userRaw } from "@/lib/ai/chat";
import { aiErrorMessage, aiRateLimit, ndjsonResponse } from "@/lib/ai/client";

// Un solo turno alla volta per conversazione: due turni in parallelo intreccerebbero la cronologia
// (che deve restare append-only per non invalidare i blocchi di thinking). In memoria, per istanza.
const g = globalThis as unknown as { __apChatBusy?: Set<string> };
const busy = (g.__apChatBusy ??= new Set<string>());
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
  const limited = aiRateLimit(user.id, "chat", isAiDemo());
  if (limited) return limited;

  let conversation;
  let isNew = false;
  if (conversationId) {
    conversation = await db.conversation.findFirst({ where: { id: conversationId, userId: user.id } });
    if (!conversation) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
    if (busy.has(conversation.id)) {
      return NextResponse.json({ error: "Sto ancora rispondendo al messaggio precedente: attendi qualche secondo." }, { status: 409 });
    }
  } else {
    if (leadId) {
      const lead = await db.lead.findFirst({ where: { id: leadId, userId: user.id }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
    }
    conversation = await db.conversation.create({ data: { userId: user.id, leadId: leadId ?? null } });
    isNew = true;
  }

  busy.add(conversation.id);
  let userMsg;
  try {
    userMsg = await db.message.create({
      data: { conversationId: conversation.id, role: "user", content: message, raw: userRaw(message) },
      select: { id: true },
    });
  } catch (err) {
    busy.delete(conversation.id);
    throw err;
  }
  const conv = conversation;
  const userMsgId = userMsg.id;

  return ndjsonResponse<ChatEvent>(
    async (send, signal) => {
      try {
        send({ type: "start", conversationId: conv.id, title: conv.title, demo: isAiDemo() });
        await runChat({ user, conversation: conv, isNew, message, emit: send, signal }, userMsgId);
      } finally {
        busy.delete(conv.id);
      }
    },
    (err) => ({ type: "error", message: aiErrorMessage(err) }),
  );
}
