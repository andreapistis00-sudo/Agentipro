import "server-only";
// Briefing pre-visita.
// Strategia in due chiamate a Opus 5.5:
//   1) ricerca con il server tool web_search (streaming, gestione pause_turn) → fatti + fonti;
//   2) structured output (output_config.format) per il JSON finale.
// Le due fasi sono separate perché gli output strutturati non sono compatibili con le citazioni
// che la ricerca web produce (400): la sintesi riceve i fatti come testo e le fonti le aggiunge il server.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "@/lib/db";
import { MODEL_SMART, anthropic, isAiDemo } from "@/lib/ai";
import { RefusalError, SMART_BETA, WEB_SEARCH_TOOL, echoContent, sleep } from "./client";
import { demoBriefing } from "./demo";
import { leadToText, todayIt, type SellerProfile } from "./lead-context";
import { briefingResearchSystemPrompt, briefingWriteSystemPrompt, briefingWriteUserPrompt } from "./prompts";
import { BriefingOutputSchema, hostOf, normalizeBriefing, type Briefing, type BriefingEvent, type Source } from "./schemas";

const MAX_CONTINUATIONS = 3;
const MAX_SOURCES = 8;

type Emit = (e: BriefingEvent) => void;

export async function loadLeadForBriefing(userId: string, leadId: string) {
  return db.lead.findFirst({
    where: { id: leadId, userId },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 15, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
  });
}
type LeadWithActivities = NonNullable<Awaited<ReturnType<typeof loadLeadForBriefing>>>;

/** Raccoglie le fonti da risultati di ricerca e citazioni, senza duplicati. */
export class SourceCollector {
  private cited: Source[] = [];
  private found: Source[] = [];
  private seen = new Set<string>();
  constructor(private onNew?: (s: Source) => void) {}
  add(s: { title: string | null; url: string }, cited = false) {
    if (!/^https?:\/\//i.test(s.url) || this.seen.has(s.url)) return;
    this.seen.add(s.url);
    const src = { title: s.title?.trim() || hostOf(s.url), url: s.url };
    (cited ? this.cited : this.found).push(src);
    this.onNew?.(src);
  }
  /** Prima le fonti citate, poi gli altri risultati. */
  list(max = MAX_SOURCES) {
    return [...this.cited, ...this.found].slice(0, max);
  }
  /** Raccoglie fonti dai content block di una risposta. */
  collect(blocks: Anthropic.Beta.BetaContentBlock[]) {
    for (const b of blocks) {
      if (b.type === "text" && b.citations) {
        for (const c of b.citations) if (c.type === "web_search_result_location") this.add({ title: c.title, url: c.url }, true);
      }
    }
    for (const b of blocks) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) this.add({ title: r.title, url: r.url });
      }
    }
  }
}

async function research(lead: LeadWithActivities, seller: SellerProfile, emit: Emit, sources: SourceCollector, signal: AbortSignal) {
  const client = anthropic();
  const query = [lead.name, lead.category, lead.address, lead.city, lead.website].filter(Boolean).join(" · ");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Cerca informazioni pubbliche su questa attività: ${query}.\n\nScheda dal CRM:\n${leadToText(lead, [])}` },
  ];
  let text = "";
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const stream = client.beta.messages.stream(
      {
        model: MODEL_SMART,
        max_tokens: 16000,
        output_config: { effort: "low" },
        system: briefingResearchSystemPrompt(seller),
        tools: [WEB_SEARCH_TOOL],
        messages,
        ...SMART_BETA,
      },
      { signal },
    );
    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const q = typeof block.input.query === "string" ? block.input.query : null;
        emit({ type: "status", phase: "research", message: q ? `Cerco «${q}»…` : "Cerco informazioni sul web…" });
      }
      if (block.type === "web_search_tool_result") sources.collect([block]);
    });
    const msg = await stream.finalMessage();
    sources.collect(msg.content);
    text += msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (msg.stop_reason === "refusal") return ""; // procedi senza ricerca: il briefing si basa sui dati del CRM
    if (msg.stop_reason !== "pause_turn") break;
    // Turno sospeso dal loop server-side: rimandiamo la risposta così com'è perché riprenda.
    messages.push({ role: "assistant", content: echoContent(msg.content) });
  }
  return text;
}

async function writeBriefing(lead: LeadWithActivities, seller: SellerProfile, researchText: string, signal: AbortSignal) {
  const res = await anthropic().beta.messages.parse(
    {
      model: MODEL_SMART,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(BriefingOutputSchema) },
      system: briefingWriteSystemPrompt(seller, todayIt()),
      messages: [{ role: "user", content: briefingWriteUserPrompt(leadToText(lead, lead.activities), researchText) }],
      ...SMART_BETA,
    },
    { signal },
  );
  if (res.stop_reason === "refusal") throw new RefusalError("Claude non ha potuto preparare il briefing per questo cliente.");
  if (!res.parsed_output) throw new Error(`Briefing non valido (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

/** Genera il briefing, emette gli stati di avanzamento e lo salva sul lead. */
export async function generateBriefing(user: SellerProfile & { id: string }, lead: LeadWithActivities, emit: Emit, signal: AbortSignal) {
  const demo = isAiDemo();
  emit({ type: "status", phase: "context", message: `Rileggo la scheda e lo storico di ${lead.name}…` });
  let briefing: Briefing;

  if (demo) {
    await sleep(500, signal);
    emit({ type: "status", phase: "research", message: `Cerco «${[lead.name, lead.city].filter(Boolean).join(" ")}»…` });
    await sleep(900, signal);
    briefing = normalizeBriefing(demoBriefing(lead, lead.activities, user));
    for (const s of briefing.sources) {
      emit({ type: "source", source: s });
      await sleep(250, signal);
    }
    emit({ type: "status", phase: "writing", message: "Preparo il briefing…" });
    await sleep(900, signal);
  } else {
    const sources = new SourceCollector((s) => emit({ type: "source", source: s }));
    emit({ type: "status", phase: "research", message: "Cerco informazioni pubbliche sull'attività…" });
    // La ricerca web è un di più: se fallisce (ricerca web non abilitata, errore temporaneo…) il briefing
    // si prepara comunque con i dati del CRM. Gli errori bloccanti (chiave, rate limit) emergono nella fase successiva.
    const facts = await research(lead, user, emit, sources, signal).catch((err) => {
      if (signal.aborted) throw err;
      console.warn("[ai/briefing] ricerca web non riuscita:", err);
      return "";
    });
    emit({ type: "status", phase: "writing", message: "Preparo il briefing…" });
    const out = await writeBriefing(lead, user, facts, signal);
    briefing = normalizeBriefing({ ...out, sources: sources.list() });
  }

  if (signal.aborted) return;
  emit({ type: "status", phase: "saving", message: "Salvo il briefing nella scheda…" });
  const briefingAt = new Date();
  await db.lead.updateMany({ where: { id: lead.id, userId: user.id }, data: { briefing: JSON.stringify(briefing), briefingAt } });
  emit({ type: "done", briefing, briefingAt: briefingAt.toISOString(), demo });
}
