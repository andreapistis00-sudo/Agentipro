import "server-only";
import { db } from "@/lib/db";
import { STAGES } from "@/lib/utils";
import { todayBounds } from "./format";
import { toActivityDTO } from "./server";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(userId: string, now = new Date()) {
  const { start, end, weekStart } = todayBounds(now);

  const [byStage, dueActivities, dueFollowUps, hotLeads, recent, doneThisWeek] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], where: { userId }, _count: { _all: true }, _sum: { value: true } }),
    db.activity.findMany({
      where: { userId, done: false, dueAt: { not: null, lte: end } },
      orderBy: { dueAt: "asc" },
      take: 30,
      include: { lead: { select: { id: true, name: true, city: true, phone: true } } },
    }),
    db.lead.findMany({
      where: { userId, nextFollowUp: { not: null, lte: end }, stage: { notIn: ["won", "lost"] } },
      orderBy: { nextFollowUp: "asc" },
      take: 30,
      select: { id: true, name: true, city: true, phone: true, stage: true, nextFollowUp: true, score: true },
    }),
    db.lead.findMany({
      where: { userId, stage: "new", score: { not: null } },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: { id: true, name: true, city: true, category: true, phone: true, score: true, value: true },
    }),
    db.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { lead: { select: { id: true, name: true } } },
    }),
    db.activity.count({
      where: { userId, done: true, type: { not: "stage" }, OR: [{ createdAt: { gte: weekStart } }, { dueAt: { gte: weekStart, lte: end } }] },
    }),
  ]);

  const stageMap = new Map(byStage.map((s) => [s.stage, { count: s._count._all, value: s._sum.value ?? 0 }]));
  const funnel = STAGES.map((s) => ({ id: s.id, label: s.label, count: stageMap.get(s.id)?.count ?? 0, value: stageMap.get(s.id)?.value ?? 0 }));
  const total = funnel.reduce((a, s) => a + s.count, 0);
  const won = stageMap.get("won")?.count ?? 0;
  const lost = stageMap.get("lost")?.count ?? 0;
  const open = funnel.filter((s) => s.id !== "won" && s.id !== "lost");

  type Todo =
    | { kind: "activity"; id: string; type: string; content: string; due: string; lead: { id: string; name: string; city: string | null; phone: string | null } }
    | { kind: "followup"; id: string; content: string; due: string; lead: { id: string; name: string; city: string | null; phone: string | null } };

  const todos: Todo[] = [
    ...dueActivities.map((a) => ({ kind: "activity" as const, id: a.id, type: a.type, content: a.content, due: a.dueAt!.toISOString(), lead: a.lead })),
    ...dueFollowUps.filter((l) => !dueActivities.some((a) => a.leadId === l.id)).map((l) => ({
      kind: "followup" as const, id: l.id, content: "Follow-up programmato", due: l.nextFollowUp!.toISOString(),
      lead: { id: l.id, name: l.name, city: l.city, phone: l.phone },
    })),
  ].sort((a, b) => a.due.localeCompare(b.due));

  return {
    kpi: {
      totalLeads: total,
      negotiation: stageMap.get("negotiation")?.count ?? 0,
      qualified: stageMap.get("qualified")?.count ?? 0,
      openPipelineValue: open.reduce((a, s) => a + s.value, 0),
      openCount: open.reduce((a, s) => a + s.count, 0),
      wonValue: stageMap.get("won")?.value ?? 0,
      conversionRate: won + lost > 0 ? won / (won + lost) : null,
      won, lost,
      doneThisWeek,
      overdue: todos.filter((t) => new Date(t.due) < start).length,
    },
    funnel,
    todos,
    hotLeads,
    recent: recent.map((a) => ({ ...toActivityDTO(a), lead: a.lead })),
  };
}
