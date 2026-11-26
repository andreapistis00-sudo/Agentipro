// Tool CRM che Claude può usare nell'assistente. Eseguiti lato server, SEMPRE filtrati per userId.
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { STAGE_IDS, stageLabel } from "@/lib/utils";
import { addDays, dayKey, romeMidnight } from "@/lib/crm/format";
import type { ChatAction } from "./schemas";

/* --------------------------------- Schemi input --------------------------------- */

const StageEnum = z.enum(STAGE_IDS);

export const SearchLeadsInput = z.object({
  q: z.string().max(120).optional(),
  stage: StageEnum.optional(),
  minScore: z.number().min(0).max(100).optional(),
  city: z.string().max(80).optional(),
  orderBy: z.enum(["score", "recent", "followup"]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});
export const LeadIdInput = z.object({ leadId: z.string().min(1).max(64) });
export const DueFollowupsInput = z.object({ days: z.number().int().min(0).max(60).optional() });
export const AddActivityInput = z.object({
  leadId: z.string().min(1).max(64),
  type: z.enum(["note", "task", "call", "email", "meeting"]),
  content: z.string().trim().min(1).max(2000),
  dueAt: z.string().max(40).optional(),
});
export const UpdateStageInput = z.object({
  leadId: z.string().min(1).max(64),
  stage: StageEnum,
  lostReason: z.string().max(300).optional(),
});

/* --------------------------------- Definizioni API --------------------------------- */

const stageDescription = `Fasi: ${STAGE_IDS.map((s) => `${s} (${stageLabel(s)})`).join(", ")}.`;

/** Definizioni dei tool client-side (ordine stabile: fa parte del prefisso del prompt). */
export const CRM_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_crm_leads",
    description:
      "Cerca tra i clienti e potenziali clienti nel CRM dell'agente. Usalo ogni volta che l'utente chiede chi contattare, quali clienti ha in una zona o categoria, le priorità, o nomina un cliente di cui ti serve l'id. Restituisce un elenco sintetico (id, nome, categoria, città, fase, punteggio, prossimo follow-up). " +
      stageDescription,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Testo libero su nome, categoria, città, note o tag" },
        stage: { type: "string", enum: [...STAGE_IDS], description: "Filtra per fase della pipeline" },
        minScore: { type: "number", description: "Punteggio AI minimo (0-100)" },
        city: { type: "string", description: "Filtra per città" },
        orderBy: { type: "string", enum: ["score", "recent", "followup"], description: "Ordinamento: punteggio (default), più recenti, follow-up più vicino" },
        limit: { type: "integer", description: "Numero massimo di risultati (1-25, default 10)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_lead_details",
    description:
      "Restituisce la scheda completa di un cliente del CRM (contatti, fase, valore, note, punteggio con motivazione) e le sue ultime 10 attività. Usalo prima di scrivere un messaggio personalizzato o di dare consigli su un cliente specifico.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string", description: "Id del cliente (da search_crm_leads)" } },
      required: ["leadId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_due_followups",
    description:
      "Elenca i follow-up e i promemoria in scadenza o scaduti: clienti con prossimo follow-up entro N giorni e attività da fare non completate. Usalo per domande come 'chi devo richiamare', 'cosa ho oggi', 'piano della settimana'.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "Orizzonte in giorni da oggi (default 7). Gli scaduti sono sempre inclusi." } },
      additionalProperties: false,
    },
  },
  {
    name: "add_activity",
    description:
      "Registra un'attività su un cliente del CRM: una nota, un promemoria (task, con data di scadenza), oppure il resoconto di una chiamata, email o visita. AZIONE DI SCRITTURA: usala quando l'utente chiede di annotare/ricordare qualcosa o quando lo implica chiaramente; poi conferma cosa hai registrato.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Id del cliente" },
        type: { type: "string", enum: ["note", "task", "call", "email", "meeting"], description: "note = nota, task = promemoria, call/email/meeting = resoconto" },
        content: { type: "string", description: "Testo dell'attività, in italiano, chiaro e autosufficiente" },
        dueAt: { type: "string", description: "Solo per i promemoria: data di scadenza YYYY-MM-DD (o data-ora ISO)" },
      },
      required: ["leadId", "type", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "update_lead_stage",
    description:
      "Sposta un cliente in un'altra fase della pipeline. AZIONE DI SCRITTURA: usala solo se l'utente lo chiede o comunica un esito chiaro (es. 'ha firmato' → won, 'non è interessato' → lost con motivo). " +
      stageDescription,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Id del cliente" },
        stage: { type: "string", enum: [...STAGE_IDS], description: "Nuova fase" },
        lostReason: { type: "string", description: "Motivo, solo se la fase è lost" },
      },
      required: ["leadId", "stage"],
      additionalProperties: false,
    },
  },
];

export const CRM_TOOL_NAMES = new Set(CRM_TOOLS.map((t) => t.name));

/** Etichetta di stato mostrata nella UI mentre il tool è in esecuzione. */
export function toolStatusLabel(name: string) {
  switch (name) {
    case "search_crm_leads": return "Consulto il tuo CRM…";
    case "get_lead_details": return "Leggo la scheda del cliente…";
    case "list_due_followups": return "Controllo i follow-up in scadenza…";
    case "add_activity": return "Registro l'attività…";
    case "update_lead_stage": return "Aggiorno la pipeline…";
    case "web_search": return "Cerco sul web…";
    default: return "Elaboro…";
  }
}

/* --------------------------------- Esecuzione --------------------------------- */

export type ToolExecution = { content: string; isError: boolean; action: ChatAction };

/** Giorno "YYYY-MM-DD" nel fuso italiano (come nel resto del CRM). */
const day = (d: Date | null | undefined) => (d ? dayKey(d) : null);

/** Interpreta "YYYY-MM-DD" (salvata alle 12:00 UTC, come nel CRM) o una data ISO. */
export function parseDue(s: string | undefined): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fail(tool: string, label: string, message: string, write = false): ToolExecution {
  return { content: JSON.stringify({ error: message }), isError: true, action: { tool, label, write, ok: false } };
}

const ACTIVITY_DONE: Record<string, string> = {
  note: "Nota aggiunta", task: "Promemoria aggiunto", call: "Chiamata registrata", email: "Email registrata", meeting: "Visita registrata",
};

/**
 * Esegue un tool CRM per l'utente indicato. Non lancia mai: gli errori tornano come risultato is_error
 * così Claude può correggersi.
 */
export async function executeCrmTool(userId: string, name: string, input: unknown, now = new Date()): Promise<ToolExecution> {
  try {
    switch (name) {
      case "search_crm_leads": {
        const p = SearchLeadsInput.safeParse(input ?? {});
        if (!p.success) return fail(name, "Ricerca nel CRM", `Input non valido: ${p.error.issues[0]?.message}`);
        const { q, stage, minScore, city, orderBy = "score", limit = 10 } = p.data;
        const term = q?.trim();
        const leads = await db.lead.findMany({
          where: {
            userId,
            ...(stage && { stage }),
            ...(minScore != null && { score: { gte: Math.round(minScore) } }),
            ...(city && { city: { contains: city.trim() } }),
            ...(term && {
              OR: [
                { name: { contains: term } }, { category: { contains: term } }, { city: { contains: term } },
                { notes: { contains: term } }, { tags: { contains: term } }, { contactName: { contains: term } },
              ],
            }),
          },
          orderBy:
            orderBy === "recent" ? [{ updatedAt: "desc" }]
            : orderBy === "followup" ? [{ nextFollowUp: { sort: "asc", nulls: "last" } }]
            : [{ score: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
          take: limit,
          select: { id: true, name: true, category: true, city: true, stage: true, score: true, value: true, nextFollowUp: true, phone: true, contactName: true, updatedAt: true },
        });
        const total = await db.lead.count({ where: { userId } });
        return {
          content: JSON.stringify({
            totalLeadsInCrm: total,
            count: leads.length,
            leads: leads.map((l) => ({
              id: l.id, name: l.name, category: l.category, city: l.city, stage: l.stage, stageLabel: stageLabel(l.stage),
              score: l.score, value: l.value, nextFollowUp: day(l.nextFollowUp), hasPhone: Boolean(l.phone), contactName: l.contactName,
            })),
          }),
          isError: false,
          action: { tool: name, label: `Ricerca nel CRM: ${leads.length} ${leads.length === 1 ? "cliente" : "clienti"}`, write: false, ok: true },
        };
      }

      case "get_lead_details": {
        const p = LeadIdInput.safeParse(input);
        if (!p.success) return fail(name, "Scheda cliente", "leadId mancante");
        const lead = await db.lead.findFirst({
          where: { id: p.data.leadId, userId },
          include: { activities: { orderBy: { createdAt: "desc" }, take: 10, select: { type: true, content: true, dueAt: true, done: true, createdAt: true } } },
        });
        if (!lead) return fail(name, "Scheda cliente", "Cliente non trovato nel CRM di questo utente");
        const { userId: _u, briefing, position: _p, activities, scoreReason, ...rest } = lead;
        void _u; void _p;
        return {
          content: JSON.stringify({
            ...rest,
            stageLabel: stageLabel(lead.stage),
            scoreReason: scoreReason ? safeJson(scoreReason) : null,
            hasBriefing: Boolean(briefing),
            activities: activities.map((a) => ({ ...a, dueAt: day(a.dueAt), createdAt: a.createdAt.toISOString() })),
          }),
          isError: false,
          action: { tool: name, label: `Scheda di ${lead.name}`, write: false, ok: true, leadId: lead.id },
        };
      }

      case "list_due_followups": {
        const p = DueFollowupsInput.safeParse(input ?? {});
        if (!p.success) return fail(name, "Follow-up", "Input non valido");
        const days = p.data.days ?? 7;
        const todayKey = dayKey(now);
        // Fino alla fine del giorno italiano "oggi + days" (days = 0 → tutto oggi).
        const until = new Date(romeMidnight(addDays(todayKey, days + 1)).getTime() - 1);
        const [leads, tasks] = await Promise.all([
          db.lead.findMany({
            where: { userId, nextFollowUp: { lte: until }, stage: { notIn: ["won", "lost"] } },
            orderBy: { nextFollowUp: "asc" },
            take: 30,
            select: { id: true, name: true, category: true, city: true, stage: true, score: true, phone: true, nextFollowUp: true },
          }),
          db.activity.findMany({
            where: { userId, done: false, dueAt: { lte: until } },
            orderBy: { dueAt: "asc" },
            take: 30,
            select: { id: true, type: true, content: true, dueAt: true, lead: { select: { id: true, name: true } } },
          }),
        ]);
        return {
          content: JSON.stringify({
            today: todayKey,
            followups: leads.map((l) => ({
              leadId: l.id, name: l.name, category: l.category, city: l.city, stage: stageLabel(l.stage), score: l.score,
              hasPhone: Boolean(l.phone), date: day(l.nextFollowUp), overdue: (day(l.nextFollowUp) ?? "") < todayKey,
            })),
            openTasks: tasks.map((t) => ({
              leadId: t.lead.id, leadName: t.lead.name, type: t.type, content: t.content, dueAt: day(t.dueAt), overdue: (day(t.dueAt) ?? "") < todayKey,
            })),
          }),
          isError: false,
          action: { tool: name, label: `Follow-up in scadenza: ${leads.length + tasks.length}`, write: false, ok: true },
        };
      }

      case "add_activity": {
        const p = AddActivityInput.safeParse(input);
        if (!p.success) return fail(name, "Registrazione attività", `Input non valido: ${p.error.issues[0]?.message}`, true);
        const lead = await db.lead.findFirst({ where: { id: p.data.leadId, userId }, select: { id: true, name: true, nextFollowUp: true } });
        if (!lead) return fail(name, "Registrazione attività", "Cliente non trovato nel CRM di questo utente", true);
        const dueAt = parseDue(p.data.dueAt);
        if (p.data.dueAt && !dueAt) return fail(name, "Registrazione attività", "Data di scadenza non valida: usa YYYY-MM-DD", true);
        const activity = await db.activity.create({
          // Stessa regola delle API del CRM: senza scadenza (e se non è un promemoria) l'attività nasce già fatta.
          data: { userId, leadId: lead.id, type: p.data.type, content: p.data.content, dueAt, done: !(p.data.type === "task" || dueAt) },
          select: { id: true, type: true, content: true, dueAt: true },
        });
        // Un promemoria più vicino del follow-up attuale diventa il prossimo follow-up del cliente.
        if (p.data.type === "task" && dueAt && (!lead.nextFollowUp || dueAt < lead.nextFollowUp)) {
          await db.lead.updateMany({ where: { id: lead.id, userId }, data: { nextFollowUp: dueAt } });
        }
        const what = ACTIVITY_DONE[p.data.type] ?? "Attività registrata";
        return {
          content: JSON.stringify({ ok: true, activity: { ...activity, dueAt: day(activity.dueAt) }, leadName: lead.name }),
          isError: false,
          action: {
            tool: name, write: true, ok: true, leadId: lead.id,
            label: `${what} su ${lead.name}${dueAt ? ` · scadenza ${dueAt.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" })}` : ""}`,
          },
        };
      }

      case "update_lead_stage": {
        const p = UpdateStageInput.safeParse(input);
        if (!p.success) return fail(name, "Cambio fase", `Input non valido: ${p.error.issues[0]?.message}`, true);
        const lead = await db.lead.findFirst({ where: { id: p.data.leadId, userId }, select: { id: true, name: true, stage: true } });
        if (!lead) return fail(name, "Cambio fase", "Cliente non trovato nel CRM di questo utente", true);
        if (lead.stage === p.data.stage) {
          return {
            content: JSON.stringify({ ok: true, unchanged: true, stage: lead.stage }),
            isError: false,
            action: { tool: name, label: `${lead.name} è già in fase ${stageLabel(lead.stage)}`, write: false, ok: true, leadId: lead.id },
          };
        }
        const last = await db.lead.aggregate({ where: { userId, stage: p.data.stage }, _max: { position: true } });
        await db.$transaction([
          db.lead.updateMany({
            where: { id: lead.id, userId },
            data: {
              stage: p.data.stage,
              position: (last._max.position ?? -1) + 1,
              lostReason: p.data.stage === "lost" ? (p.data.lostReason ?? null) : null,
            },
          }),
          db.activity.create({
            data: {
              userId, leadId: lead.id, type: "stage", done: true,
              content: `Fase: ${stageLabel(lead.stage)} → ${stageLabel(p.data.stage)}${p.data.stage === "lost" && p.data.lostReason ? ` (${p.data.lostReason})` : ""} · dall'assistente`,
            },
          }),
        ]);
        return {
          content: JSON.stringify({ ok: true, leadName: lead.name, from: lead.stage, to: p.data.stage }),
          isError: false,
          action: { tool: name, label: `${lead.name}: ${stageLabel(lead.stage)} → ${stageLabel(p.data.stage)}`, write: true, ok: true, leadId: lead.id },
        };
      }

      default:
        return fail(name, name, `Strumento sconosciuto: ${name}`);
    }
  } catch (err) {
    console.error(`[ai/tools] ${name}`, err);
    return fail(name, toolStatusLabel(name).replace("…", ""), "Errore interno durante l'esecuzione dello strumento");
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
