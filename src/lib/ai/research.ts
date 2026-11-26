import "server-only";
// Scheda AI: ricerca di informazioni pubbliche su un cliente (fatti con fonti, nessun consiglio commerciale).
// Strategia in due chiamate a MODEL_SMART (Sonnet 5.5):
//   1) ricerca con il server tool web_search (streaming, gestione pause_turn) → fatti + fonti;
//   2) structured output (output_config.format) per la scheda strutturata.
// Le due fasi sono separate perché gli output strutturati non sono compatibili con le citazioni
// che la ricerca web produce (400): la sintesi riceve i fatti come testo e le fonti le aggiunge il server.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "@/lib/db";
import { MODEL_SMART, anthropic, isAiDemo } from "@/lib/ai";
import { RefusalError, SMART_BETA, WEB_SEARCH_TOOL, echoContent, sleep } from "./client";
import { demoResearch } from "./demo";
import { leadToText, todayIt, type SellerProfile } from "./lead-context";
import { researchSearchSystemPrompt, researchWriteSystemPrompt, researchWriteUserPrompt } from "./prompts";
import { ResearchOutputSchema, hostOf, researchFromOutput, type Research, type ResearchEvent, type Source } from "./schemas";

const MAX_CONTINUATIONS = 3;
const MAX_SOURCES = 8;

type Emit = (e: ResearchEvent) => void;

export async function loadLeadForResearch(userId: string, leadId: string) {
  return db.lead.findFirst({
    where: { id: leadId, userId },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 15, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
  });
}
type LeadWithActivities = NonNullable<Awaited<ReturnType<typeof loadLeadForResearch>>>;

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

async function searchWeb(lead: LeadWithActivities, seller: SellerProfile, emit: Emit, sources: SourceCollector, signal: AbortSignal) {
  const client = anthropic();
  const query = [lead.name, lead.category, lead.address, lead.city, lead.website].filter(Boolean).join(" · ");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Cerca informazioni pubbliche su questa attività: ${query}.\n\nDati già presenti nel CRM dell'agente:\n${leadToText(lead, [])}` },
  ];
  let text = "";
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const stream = client.beta.messages.stream(
      {
        model: MODEL_SMART,
        max_tokens: 16000,
        output_config: { effort: "low" },
        system: researchSearchSystemPrompt(seller),
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
    if (msg.stop_reason === "refusal") return ""; // procedi senza ricerca: la scheda si basa sui dati del CRM
    if (msg.stop_reason !== "pause_turn") break;
    // Turno sospeso dal loop server-side: rimandiamo la risposta così com'è perché riprenda.
    messages.push({ role: "assistant", content: echoContent(msg.content) });
  }
  return text;
}

async function writeResearch(lead: LeadWithActivities, researchText: string, signal: AbortSignal) {
  const res = await anthropic().beta.messages.parse(
    {
      model: MODEL_SMART,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(ResearchOutputSchema) },
      system: researchWriteSystemPrompt(todayIt()),
      messages: [{ role: "user", content: researchWriteUserPrompt(leadToText(lead, lead.activities), researchText) }],
      ...SMART_BETA,
    },
    { signal },
  );
  if (res.stop_reason === "refusal") throw new RefusalError("Claude non ha potuto compilare la scheda di questo cliente.");
  if (!res.parsed_output) throw new Error(`Scheda non valida (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

/** Compila la Scheda AI, emette gli stati di avanzamento e la salva sul lead (campo `briefing`). */
export async function generateResearch(user: SellerProfile & { id: string }, lead: LeadWithActivities, emit: Emit, signal: AbortSignal) {
  const demo = isAiDemo();
  emit({ type: "status", phase: "context", message: `Rileggo i dati e le note su ${lead.name}…` });
  let research: Research;

  if (demo) {
    await sleep(500, signal);
    emit({ type: "status", phase: "research", message: `Cerco «${[lead.name, lead.city].filter(Boolean).join(" ")}»…` });
    await sleep(900, signal);
    research = demoResearch(lead, lead.activities);
    for (const s of research.sources) {
      emit({ type: "source", source: s });
      await sleep(250, signal);
    }
    emit({ type: "status", phase: "writing", message: "Organizzo le informazioni trovate…" });
    await sleep(900, signal);
  } else {
    const sources = new SourceCollector((s) => emit({ type: "source", source: s }));
    emit({ type: "status", phase: "research", message: "Cerco informazioni pubbliche sull'attività…" });
    // La ricerca web è un di più: se fallisce (ricerca web non abilitata, errore temporaneo…) la scheda
    // si compila comunque con i dati del CRM. Gli errori bloccanti (chiave, rate limit) emergono nella fase successiva.
    const facts = await searchWeb(lead, user, emit, sources, signal).catch((err) => {
      if (signal.aborted) throw err;
      console.warn("[ai/research] ricerca web non riuscita:", err);
      return "";
    });
    emit({ type: "status", phase: "writing", message: "Organizzo le informazioni trovate…" });
    const out = await writeResearch(lead, facts, signal);
    research = researchFromOutput(out, sources.list());
  }

  if (signal.aborted) return;
  emit({ type: "status", phase: "saving", message: "Salvo la scheda…" });
  const researchAt = new Date();
  await db.lead.updateMany({ where: { id: lead.id, userId: user.id }, data: { briefing: JSON.stringify(research), briefingAt: researchAt } });
  emit({ type: "done", research, researchAt: researchAt.toISOString(), demo });
}
