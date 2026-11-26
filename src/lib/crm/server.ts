import "server-only";
import type { Activity, Lead, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stageLabel, type StageId } from "@/lib/utils";
import { parseTags, serializeTags } from "./format";
import type { LeadPatchInput, LeadQueryInput } from "./schemas";
import type { ActivityDTO, LeadDTO } from "./types";

type Tx = Prisma.TransactionClient;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toLeadDTO(l: Lead): LeadDTO {
  return {
    id: l.id, name: l.name, category: l.category, address: l.address, city: l.city, lat: l.lat, lng: l.lng,
    phone: l.phone, email: l.email, website: l.website, openingHours: l.openingHours, rating: l.rating,
    reviewsCount: l.reviewsCount, source: l.source, stage: l.stage, position: l.position, value: l.value,
    contactName: l.contactName, contactRole: l.contactRole, notes: l.notes, tags: parseTags(l.tags),
    nextFollowUp: iso(l.nextFollowUp), lostReason: l.lostReason, score: l.score, scoreReason: l.scoreReason, scoreBreakdown: l.scoreBreakdown,
    scoredAt: iso(l.scoredAt), briefing: l.briefing, briefingAt: iso(l.briefingAt),
    createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString(),
  };
}

export function toActivityDTO(a: Activity): ActivityDTO {
  return { id: a.id, leadId: a.leadId, type: a.type, content: a.content, dueAt: iso(a.dueAt), done: a.done, createdAt: a.createdAt.toISOString() };
}

/** Filtro Prisma per un tag esatto dentro il CSV `tags` (tollera spazi dopo la virgola). */
function tagWhere(tag: string): Prisma.LeadWhereInput {
  return {
    OR: [
      { tags: { equals: tag } },
      { tags: { startsWith: `${tag},` } },
      { tags: { endsWith: `,${tag}` } },
      { tags: { endsWith: `, ${tag}` } },
      { tags: { contains: `,${tag},` } },
      { tags: { contains: `, ${tag},` } },
    ],
  };
}

export function leadWhere(userId: string, q: Partial<LeadQueryInput>): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ userId }];
  if (q.q) {
    const t = q.q;
    and.push({
      OR: [
        { name: { contains: t } }, { city: { contains: t } }, { category: { contains: t } },
        { contactName: { contains: t } }, { address: { contains: t } }, { email: { contains: t } },
        { phone: { contains: t } }, { tags: { contains: t } },
      ],
    });
  }
  if (q.stage === "open") and.push({ stage: { notIn: ["won", "lost"] } });
  else if (q.stage) and.push({ stage: q.stage });
  if (q.minScore != null) and.push({ score: { gte: q.minScore } });
  if (q.tag) and.push(tagWhere(q.tag));
  return { AND: and };
}

export function leadOrderBy(sort: LeadQueryInput["sort"]): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "score": return [{ score: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }];
    case "name": return [{ name: "asc" }];
    case "followup": return [{ nextFollowUp: { sort: "asc", nulls: "last" } }, { score: { sort: "desc", nulls: "last" } }];
    case "value": return [{ value: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }];
    case "created": return [{ createdAt: "desc" }];
    default: return [{ updatedAt: "desc" }];
  }
}

export async function listLeads(userId: string, q: LeadQueryInput) {
  const where = leadWhere(userId, q);
  const [total, rows] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, orderBy: leadOrderBy(q.sort), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { leads: rows.map(toLeadDTO), total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Tutti i tag usati dall'utente (per i filtri), ordinati per frequenza. */
export async function userTags(userId: string) {
  const rows = await db.lead.findMany({ where: { userId, tags: { not: null } }, select: { tags: true } });
  const count = new Map<string, { label: string; n: number }>();
  for (const r of rows) for (const t of parseTags(r.tags)) {
    const k = t.toLowerCase();
    const cur = count.get(k);
    if (cur) cur.n++; else count.set(k, { label: t, n: 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "it")).map((x) => x.label);
}

export function getLead(userId: string, id: string) {
  return db.lead.findFirst({ where: { id, userId } });
}

export function stageActivityText(from: string, to: string, lostReason?: string | null) {
  const base = `Spostato da ${stageLabel(from)} a ${stageLabel(to)}`;
  return to === "lost" && lostReason ? `${base}. Motivo: ${lostReason}` : base;
}

async function logStage(tx: Tx, userId: string, leadId: string, from: string, to: string, lostReason?: string | null) {
  await tx.activity.create({ data: { userId, leadId, type: "stage", content: stageActivityText(from, to, lostReason), done: true } });
}

/** Posizione in cima alla colonna (usata quando lo stage cambia fuori dal kanban). */
async function topPosition(tx: Tx, userId: string, stage: string) {
  const first = await tx.lead.findFirst({ where: { userId, stage }, orderBy: { position: "asc" }, select: { position: true } });
  return first ? first.position - 1 : 0;
}

/** Converte l'input PATCH nei dati Prisma (gestendo tag e motivo di perdita). */
function patchData(input: LeadPatchInput): Prisma.LeadUpdateInput {
  const { tags, ...rest } = input;
  const data: Prisma.LeadUpdateInput = { ...rest };
  if (tags !== undefined) data.tags = serializeTags(tags);
  return data;
}

export async function updateLead(userId: string, id: string, input: LeadPatchInput) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, userId } });
    if (!lead) return null;
    const data = patchData(input);
    const stageChanged = input.stage !== undefined && input.stage !== lead.stage;
    if (stageChanged) {
      data.position = await topPosition(tx, userId, input.stage!);
      if (input.stage !== "lost") data.lostReason = null;
      await logStage(tx, userId, id, lead.stage, input.stage!, input.lostReason);
    } else if (input.lostReason !== undefined && lead.stage !== "lost" && input.stage !== "lost") {
      delete data.lostReason; // il motivo ha senso solo per i lead persi
    }
    return tx.lead.update({ where: { id }, data });
  });
}

export async function bulkSetStage(userId: string, ids: string[], stage: StageId, lostReason?: string | null) {
  return db.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { userId, id: { in: ids } }, orderBy: { position: "asc" } });
    let pos = await topPosition(tx, userId, stage);
    let changed = 0;
    for (const l of [...leads].reverse()) {
      if (l.stage === stage) continue;
      await tx.lead.update({
        where: { id: l.id },
        data: { stage, position: pos--, lostReason: stage === "lost" ? (lostReason ?? l.lostReason) : null },
      });
      await logStage(tx, userId, l.id, l.stage, stage, lostReason);
      changed++;
    }
    return { updated: changed, matched: leads.length };
  });
}

/** Riordino "silenzioso": non tocca updatedAt degli altri lead della colonna. */
function setPosition(tx: Tx, id: string, position: number) {
  return tx.$executeRaw`UPDATE "Lead" SET "position" = ${position} WHERE "id" = ${id}`;
}

/** Sposta un lead nella colonna `stage` all'indice `index` e rinumera le posizioni (destinazione e sorgente). */
export async function moveLead(userId: string, leadId: string, stage: StageId, index: number, lostReason?: string | null) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) return null;
    const column = await tx.lead.findMany({
      where: { userId, stage, id: { not: leadId } },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      select: { id: true, position: true },
    });
    const at = Math.min(index, column.length);
    const ordered = [...column.slice(0, at).map((c) => c.id), leadId, ...column.slice(at).map((c) => c.id)];
    const stageChanged = lead.stage !== stage;
    for (let i = 0; i < ordered.length; i++) {
      const id = ordered[i];
      if (id === leadId) {
        await tx.lead.update({
          where: { id },
          data: {
            stage, position: i,
            ...(stageChanged ? { lostReason: stage === "lost" ? (lostReason ?? null) : null } : lostReason !== undefined && stage === "lost" ? { lostReason } : {}),
          },
        });
      } else if (column.find((c) => c.id === id)!.position !== i) {
        await setPosition(tx, id, i);
      }
    }
    if (stageChanged) {
      const source = await tx.lead.findMany({ where: { userId, stage: lead.stage }, orderBy: [{ position: "asc" }, { updatedAt: "desc" }], select: { id: true, position: true } });
      for (let i = 0; i < source.length; i++) if (source[i].position !== i) await setPosition(tx, source[i].id, i);
      await logStage(tx, userId, leadId, lead.stage, stage, lostReason);
    }
    return { id: leadId, stage, index: at, from: lead.stage };
  });
}
