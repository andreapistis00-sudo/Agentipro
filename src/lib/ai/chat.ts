import "server-only";
// Assistente chat: loop manuale dei tool con streaming (MODEL_SMART, Sonnet 5.5) oppure risposte demo che usano i dati reali del CRM.
import Anthropic from "@anthropic-ai/sdk";
import type { Conversation, Message } from "@prisma/client";
import { db } from "@/lib/db";
import { MODEL_FAST, MODEL_SMART, anthropic, isAiDemo } from "@/lib/ai";
import { CHAT_BETA, WEB_SEARCH_TOOL, echoContent, sleep } from "./client";
import { SourceCollector } from "./briefing";
import {
  chunkText, demoAnswerEmail, demoAnswerFollowups, demoAnswerGeneric, demoAnswerLeadAdvice, demoAnswerObjection,
  demoAnswerPlan, demoAnswerPrioritize, demoTitle, detectIntent, type DemoFollowups, type DemoLeadRow,
} from "./demo";
import { leadToText, todayIt, type SellerProfile } from "./lead-context";
import { TITLE_SYSTEM_PROMPT, chatSystemPrompt } from "./prompts";
import type { ChatAction, ChatEvent, MessageMeta } from "./schemas";
import { CRM_TOOLS, CRM_TOOL_NAMES, executeCrmTool, toolStatusLabel, type ToolExecution } from "./tools";

const MAX_ITERATIONS = 8;
const MAX_STREAM_RETRIES = 2;
/**
 * Righe (messaggi utente + risposte) rigiocate al modello. Entro il limite la cronologia è append-only;
 * oltre, la finestra scorre e cambia il prefisso: in quel caso si tolgono tutti i blocchi di thinking
 * (rimuoverli tutti è consentito) invece di rispedire blocchi legati a un prefisso che non esiste più.
 */
export const HISTORY_LIMIT = 200;

type Emit = (e: ChatEvent) => void;
type ApiMessage = Anthropic.Beta.BetaMessageParam;

/** Contenuto di `Message.raw`. */
type UserRaw = { v: 1; api: string };
type AssistantRaw = { v: 1; system?: string; day?: string; messages?: ApiMessage[] } & MessageMeta;

const romeDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);

function parseRaw<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const isThinking = (b: { type: string }) => b.type === "thinking" || b.type === "redacted_thinking";

/** Toglie i blocchi di thinking da un messaggio (usato solo quando la finestra della cronologia scorre). */
function withoutThinking(m: ApiMessage): ApiMessage | null {
  if (m.role !== "assistant" || typeof m.content === "string") return m;
  const content = m.content.filter((b) => !isThinking(b));
  return content.length ? { ...m, content } : null;
}

/**
 * Ricostruisce la cronologia API dai messaggi salvati, rispedendo invariati i content block (thinking inclusi):
 * la cronologia è append-only, quindi i blocchi di thinking restano validi tra un turno e l'altro.
 * - I turni rifiutati (stop_reason "refusal") vengono esclusi insieme al messaggio utente che li ha causati,
 *   sempre allo stesso modo, così il prefisso resta stabile e la richiesta rifiutata non viene ripetuta.
 * - Con `stripThinking` (finestra scorrevole oltre HISTORY_LIMIT) si tolgono tutti i blocchi di thinking.
 */
export function buildHistory(rows: Pick<Message, "role" | "content" | "raw">[], opts: { stripThinking?: boolean } = {}): ApiMessage[] {
  let out: ApiMessage[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if (m.role === "user") {
      const next = rows[i + 1];
      if (next?.role === "assistant" && parseRaw<AssistantRaw>(next.raw)?.stopped === "refusal") {
        i++; // salta domanda e rifiuto
        continue;
      }
      const raw = parseRaw<UserRaw>(m.raw);
      out.push({ role: "user", content: raw?.api ?? m.content });
    } else {
      const raw = parseRaw<AssistantRaw>(m.raw);
      if (raw?.stopped === "refusal") continue;
      if (raw?.messages?.length) out.push(...raw.messages);
      else if (m.content.trim()) out.push({ role: "assistant", content: m.content });
    }
  }
  if (opts.stripThinking) out = out.map(withoutThinking).filter((m): m is ApiMessage => m !== null);
  // La cronologia deve iniziare con un messaggio utente "vero" (non con tool_result orfani).
  const orphan = (m: ApiMessage) => m.role !== "user" || (Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
  while (out.length && orphan(out[0])) out.shift();
  return out;
}

export { echoContent };

type RunArgs = {
  user: SellerProfile & { id: string };
  conversation: Conversation;
  isNew: boolean;
  message: string;
  emit: Emit;
  signal: AbortSignal;
};

export type ChatOutcome = { text: string; raw: AssistantRaw; userApi?: string };

/* ------------------------------------ Titolo ------------------------------------ */

async function generateTitle(message: string): Promise<string> {
  if (isAiDemo()) return demoTitle(message);
  try {
    const res = await anthropic().messages.create({
      model: MODEL_FAST,
      max_tokens: 1000,
      output_config: { effort: "low" },
      system: TITLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message.slice(0, 1500) }],
    });
    const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").replace(/["«»\n]/g, " ").replace(/\s+/g, " ").trim().replace(/[.]$/, "");
    return t ? t.slice(0, 80) : demoTitle(message);
  } catch (err) {
    console.error("[ai/chat] titolo", err);
    return demoTitle(message);
  }
}

/* ------------------------------------ Live ------------------------------------ */

async function systemFor(conversation: Conversation, user: SellerProfile & { id: string }) {
  // Il prompt di sistema resta quello del primo turno: il prefisso deve restare identico
  // tra un turno e l'altro (cache e blocchi di thinking legati alla conversazione).
  const first = await db.message.findFirst({
    where: { conversationId: conversation.id, role: "assistant", raw: { contains: "\"system\"" } },
    orderBy: { createdAt: "asc" },
    select: { raw: true },
  });
  const stored = parseRaw<AssistantRaw>(first?.raw ?? null);
  if (stored?.system) return { system: stored.system, day: stored.day ?? null, fresh: false };
  let leadText: string | null = null;
  if (conversation.leadId) {
    const lead = await db.lead.findFirst({
      where: { id: conversation.leadId, userId: user.id },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 10, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
    });
    if (lead) leadText = `Id cliente: ${lead.id}\n${leadToText(lead, lead.activities)}`;
  }
  return { system: chatSystemPrompt(user, todayIt(), leadText), day: romeDay(), fresh: true };
}

async function runLive({ user, conversation, message, emit, signal }: RunArgs, history: ApiMessage[]): Promise<ChatOutcome> {
  const client = anthropic();
  const { system, day, fresh } = await systemFor(conversation, user);
  // Se la conversazione è iniziata in un altro giorno, la data aggiornata va nel nuovo messaggio (append-only).
  const today = romeDay();
  const apiUser = day && day !== today ? `[Oggi è ${todayIt()}]\n\n${message}` : message;
  const base: ApiMessage[] = [...history, { role: "user", content: apiUser }];
  const turn: ApiMessage[] = [];
  const actions: ChatAction[] = [];
  const sources = new SourceCollector((s) => emit({ type: "source", source: s }));
  let text = "";
  let stopped: MessageMeta["stopped"];
  let retries = 0;
  let paused = false;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let firstDelta = true;
    const stream = client.beta.messages.stream(
      {
        model: MODEL_SMART,
        max_tokens: 32000,
        system,
        tools: [...CRM_TOOLS, WEB_SEARCH_TOOL],
        messages: [...base, ...turn],
        output_config: { effort: "medium" },
        thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
        ...CHAT_BETA,
      },
      { signal },
    );
    stream.on("text", (delta) => {
      if (firstDelta && text && !text.endsWith("\n")) {
        text += "\n\n";
        emit({ type: "delta", text: "\n\n" });
      }
      firstDelta = false;
      text += delta;
      emit({ type: "delta", text: delta });
    });
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start") {
        const b = event.content_block;
        if (b.type === "tool_use" || b.type === "server_tool_use") emit({ type: "status", message: toolStatusLabel(b.name) });
      }
    });
    stream.on("contentBlock", (block) => {
      if (block.type === "web_search_tool_result") sources.collect([block]);
      if (block.type === "server_tool_use" && block.name === "web_search" && typeof block.input.query === "string") {
        emit({ type: "status", message: `Cerco sul web «${block.input.query}»…` });
      }
    });

    let msg: Anthropic.Beta.BetaMessage;
    try {
      msg = await stream.finalMessage();
      retries = 0;
    } catch (err) {
      // Errori API (auth, rate limit…) risalgono; JSON di un tool non interpretabile o connessione caduta: si riprova il turno.
      if (err instanceof Anthropic.APIError || signal.aborted || retries++ >= MAX_STREAM_RETRIES) throw err;
      console.warn("[ai/chat] turno ripetuto:", err);
      continue;
    }

    sources.collect(msg.content);
    paused = false;
    if (msg.stop_reason === "refusal") {
      stopped = "refusal";
      const note = "Mi dispiace, non posso aiutarti con questa richiesta. Prova a riformularla.";
      emit({ type: "delta", text: text ? `\n\n${note}` : note });
      text += text ? `\n\n${note}` : note;
      return { text, userApi: apiUser, raw: { v: 1, actions, sources: sources.list(20), stopped } }; // turno rifiutato: non va rigiocato
    }
    const content = echoContent(msg.content);
    turn.push({ role: "assistant", content });

    // Il loop server-side (ricerca web) si è fermato: rimandiamo il turno così com'è perché riprenda.
    if (msg.stop_reason === "pause_turn") {
      paused = true;
      continue;
    }

    const truncated = msg.stop_reason === "max_tokens" || msg.stop_reason === "model_context_window_exceeded";
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) {
      if (truncated) stopped = "max_tokens";
      break;
    }
    if (truncated) {
      // Input del tool troncato: non eseguirlo.
      stopped = "max_tokens";
      turn.pop();
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      emit({ type: "status", message: toolStatusLabel(tu.name) });
      const exec: ToolExecution = CRM_TOOL_NAMES.has(tu.name)
        ? await executeCrmTool(user.id, tu.name, tu.input)
        : { content: JSON.stringify({ error: `Strumento sconosciuto: ${tu.name}` }), isError: true, action: { tool: tu.name, label: tu.name, write: false, ok: false } };
      actions.push(exec.action);
      emit({ type: "action", action: exec.action });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: exec.content, ...(exec.isError && { is_error: true }) });
    }
    turn.push({ role: "user", content: results });
    emit({ type: "status", message: null });
  }

  // Iterazioni esaurite su un turno ancora in pausa: quella risposta non è mai stata rispedita, quindi
  // non salvarla (finirebbe in mezzo alla cronologia con un server_tool_use in sospeso).
  if (paused) turn.pop();

  emit({ type: "status", message: null });
  if (!text.trim()) {
    text = "Ho completato le operazioni richieste.";
    emit({ type: "delta", text });
  }
  return {
    text,
    userApi: apiUser,
    raw: { v: 1, ...(fresh && { system, day: day ?? today }), messages: turn, actions, sources: sources.list(20), ...(stopped && { stopped }) },
  };
}

/* ------------------------------------ Demo ------------------------------------ */

async function runDemo({ user, conversation, message, emit, signal }: RunArgs): Promise<ChatOutcome> {
  const actions: ChatAction[] = [];
  const tool = async (name: string, input: unknown) => {
    emit({ type: "status", message: toolStatusLabel(name) });
    await sleep(450, signal);
    const exec = await executeCrmTool(user.id, name, input);
    actions.push(exec.action);
    emit({ type: "action", action: exec.action });
    return exec.isError ? null : JSON.parse(exec.content);
  };

  const lead = conversation.leadId
    ? await db.lead.findFirst({ where: { id: conversation.leadId, userId: user.id }, select: { id: true, name: true, category: true, city: true, contactName: true, stage: true, score: true, nextFollowUp: true } })
    : null;
  const intent = detectIntent(message, Boolean(lead));
  await sleep(300, signal);

  let answer: string;
  switch (intent.kind) {
    case "prioritize": {
      const due = (await tool("list_due_followups", { days: 3 })) as DemoFollowups | null;
      const res = (await tool("search_crm_leads", { orderBy: "score", limit: 8 })) as { leads: DemoLeadRow[] } | null;
      const active = (res?.leads ?? []).filter((l) => l.stage !== "won" && l.stage !== "lost");
      answer = demoAnswerPrioritize(active, due ?? { followups: [], openTasks: [] }, user);
      break;
    }
    case "followups": {
      const due = (await tool("list_due_followups", { days: 7 })) as DemoFollowups | null;
      answer = demoAnswerFollowups(due ?? { followups: [], openTasks: [] });
      break;
    }
    case "email": {
      let target = lead;
      if (!target && intent.target) {
        const res = (await tool("search_crm_leads", { q: intent.target.split(/\s+/).slice(0, 3).join(" "), limit: 1 })) as { leads: DemoLeadRow[] } | null;
        const found = res?.leads?.[0];
        if (found) {
          const det = await tool("get_lead_details", { leadId: found.id });
          if (det) target = { id: det.id, name: det.name, category: det.category, city: det.city, contactName: det.contactName, stage: det.stage, score: det.score, nextFollowUp: det.nextFollowUp };
        }
      } else if (target) {
        await tool("get_lead_details", { leadId: target.id });
      }
      answer = demoAnswerEmail(user, target, intent.target);
      break;
    }
    case "objection":
      answer = demoAnswerObjection(intent.objection, user);
      break;
    case "plan": {
      const res = (await tool("search_crm_leads", { orderBy: "score", limit: 20 })) as { leads: DemoLeadRow[] } | null;
      answer = demoAnswerPlan((res?.leads ?? []).filter((l) => l.stage !== "won" && l.stage !== "lost"), user);
      break;
    }
    case "note": {
      const type = intent.due ? "task" : "note";
      const stripped = intent.content.replace(/^(per favore\s+)?(segna(mi)?|annota(mi)?|ricordami( di)?|registra)\s*(che\s*)?/i, "").trim() || intent.content;
      const content = stripped.charAt(0).toUpperCase() + stripped.slice(1);
      const done = await tool("add_activity", { leadId: lead!.id, type, content, ...(intent.due && { dueAt: intent.due }) });
      answer = done
        ? `Fatto: ho registrato ${type === "task" ? "un **promemoria**" : "una **nota**"} su **${lead!.name}**${intent.due ? ` con scadenza **${new Date(`${intent.due}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}**` : ""}.\n\n> ${content}\n\nLo trovi nello storico della scheda cliente${type === "task" ? " e tra i follow-up di Oggi" : ""}.`
        : "Non sono riuscito a registrare l'attività. Riprova dalla scheda cliente.";
      break;
    }
    case "stage": {
      const done = await tool("update_lead_stage", { leadId: lead!.id, stage: intent.stage });
      answer = done ? `Fatto: **${lead!.name}** è ora in fase **${actions.at(-1)?.label.split("→ ")[1] ?? intent.stage}**. Vuoi che aggiunga anche una nota con i dettagli?` : "Non sono riuscito ad aggiornare la fase.";
      break;
    }
    case "lead_advice":
      await tool("get_lead_details", { leadId: lead!.id });
      answer = demoAnswerLeadAdvice(lead!, user);
      break;
    default:
      answer = demoAnswerGeneric(message, user);
  }

  emit({ type: "status", message: null });
  let text = "";
  for (const chunk of chunkText(answer, 2)) {
    if (signal.aborted) break;
    text += chunk;
    emit({ type: "delta", text: chunk });
    await sleep(18 + (chunk.length % 5) * 6, signal);
  }
  return { text, raw: { v: 1, actions, demo: true } };
}

/* ------------------------------------ Entry point ------------------------------------ */

/** Esegue un turno di chat e salva la risposta. Il messaggio utente è già stato salvato dal chiamante. */
export async function runChat(args: RunArgs, userMessageId: string) {
  const { conversation, isNew, message, emit, signal } = args;
  const titlePromise = isNew
    ? generateTitle(message).then(async (title) => {
        await db.conversation.update({ where: { id: conversation.id }, data: { title } });
        emit({ type: "title", title });
      }).catch((e) => console.error("[ai/chat] titolo", e))
    : Promise.resolve();

  const rows = await db.message.findMany({
    where: { conversationId: conversation.id, NOT: { id: userMessageId } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT + 1,
    select: { role: true, content: true, raw: true },
  });
  const windowed = rows.length > HISTORY_LIMIT;
  const history = buildHistory(rows.slice(0, HISTORY_LIMIT).reverse(), { stripThinking: windowed });

  let outcome: ChatOutcome;
  try {
    outcome = isAiDemo() ? await runDemo(args) : await runLive(args, history);
  } finally {
    await titlePromise;
  }

  if (outcome.userApi && outcome.userApi !== message) {
    await db.message.update({ where: { id: userMessageId }, data: { raw: userRaw(outcome.userApi) } });
  }
  if (signal.aborted && !outcome.text.trim()) return;
  const saved = await db.message.create({
    data: { conversationId: conversation.id, role: "assistant", content: outcome.text, raw: JSON.stringify(outcome.raw) },
    select: { id: true },
  });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  emit({ type: "done", conversationId: conversation.id, messageId: saved.id });
}

/** Salva il messaggio utente con il testo effettivamente inviato all'API (per il replay). */
export function userRaw(message: string): string {
  return JSON.stringify({ v: 1, api: message } satisfies UserRaw);
}
