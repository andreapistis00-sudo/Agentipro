// Conversione dei messaggi salvati nel formato usato dalla UI (senza i content block API).
import type { Message } from "@prisma/client";
import type { ChatMessageView, MessageMeta } from "./schemas";

export function toMessageView(m: Pick<Message, "id" | "role" | "content" | "raw" | "createdAt">): ChatMessageView {
  let meta: MessageMeta = {};
  if (m.role === "assistant" && m.raw) {
    try {
      const raw = JSON.parse(m.raw) as MessageMeta;
      meta = { sources: raw.sources, actions: raw.actions, demo: raw.demo, stopped: raw.stopped };
    } catch {
      /* raw non valido: solo testo */
    }
  }
  return { id: m.id, role: m.role === "user" ? "user" : "assistant", content: m.content, createdAt: m.createdAt.toISOString(), ...meta };
}
