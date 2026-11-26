import { requireUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import { db } from "@/lib/db";
import { toMessageView } from "@/lib/ai/messages";
import type { ConversationSummary } from "@/lib/ai/schemas";
import { ChatApp, type ChatLead } from "@/components/ai/assistant/chat-app";

export const metadata = { title: "Assistente" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; leadId?: string }> }) {
  const user = await requireUser();
  const { c, leadId } = await searchParams;

  const rows = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, leadId: true, updatedAt: true },
  });
  const active = c ? rows.find((r) => r.id === c) ?? null : null;
  const wantedLeadId = active?.leadId ?? leadId ?? null;
  const leadIds = [...new Set([...rows.map((r) => r.leadId), wantedLeadId].filter((x): x is string => Boolean(x)))];
  const leads = leadIds.length
    ? await db.lead.findMany({ where: { userId: user.id, id: { in: leadIds } }, select: { id: true, name: true, category: true, city: true } })
    : [];
  const byId = new Map(leads.map((l) => [l.id, l]));

  const conversations: ConversationSummary[] = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
    lead: r.leadId ? (byId.get(r.leadId) ? { id: r.leadId, name: byId.get(r.leadId)!.name } : null) : null,
  }));
  const messages = active
    ? (await db.message.findMany({ where: { conversationId: active.id }, orderBy: { createdAt: "asc" } })).map(toMessageView)
    : [];
  const lead: ChatLead | null = wantedLeadId ? byId.get(wantedLeadId) ?? null : null;

  return (
    <ChatApp
      userName={user.name.split(" ")[0]}
      demo={isAiDemo()}
      profileIncomplete={!user.products && !user.idealCustomer}
      initialConversations={conversations}
      initialConversationId={active?.id ?? null}
      initialMessages={messages}
      initialLead={lead}
    />
  );
}
