import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { CurrentUser } from "./auth";

/** Modello per ragionamenti complessi (chat, briefing). */
export const MODEL_SMART = process.env.AI_MODEL_SMART || "claude-sonnet-5-5";
/** Modello veloce/economico per task semplici e massivi (lead score). */
export const MODEL_FAST = process.env.AI_MODEL_FAST || "claude-haiku-5-5";

/** Senza ANTHROPIC_API_KEY l'app usa risposte dimostrative. */
export function isAiDemo() {
  return !process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
export function anthropic() {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Contesto del venditore da includere nei prompt di sistema. */
export function sellerContext(u: Pick<CurrentUser, "name" | "company" | "sector" | "products" | "idealCustomer" | "territory" | "tone">) {
  const lines = [
    `Nome agente: ${u.name}`,
    u.company && `Azienda/mandante: ${u.company}`,
    u.sector && `Settore: ${u.sector}`,
    u.products && `Prodotti/servizi venduti: ${u.products}`,
    u.idealCustomer && `Cliente ideale: ${u.idealCustomer}`,
    u.territory && `Territorio: ${u.territory}`,
    u.tone && `Tono preferito: ${u.tone}`,
  ].filter(Boolean);
  return lines.join("\n");
}
