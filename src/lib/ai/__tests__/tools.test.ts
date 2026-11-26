import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn() },
  activity: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));

import { CRM_TOOLS, executeCrmTool, parseDue } from "../tools";

const USER = "user_1";
const NOW = new Date("2026-11-26T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("definizioni dei tool", () => {
  it("hanno nomi unici e schema chiuso", () => {
    const names = CRM_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["search_crm_leads", "get_lead_details", "list_due_followups", "add_activity", "update_lead_stage"]);
    for (const t of CRM_TOOLS) expect(t.input_schema.additionalProperties).toBe(false);
  });
});

describe("search_crm_leads", () => {
  it("filtra sempre per userId e applica i filtri", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1", name: "Bar Centrale", category: "Bar", city: "Milano", stage: "new", score: 80, value: null, nextFollowUp: null, phone: "1", contactName: null, updatedAt: NOW }]);
    db.lead.count.mockResolvedValue(12);
    const r = await executeCrmTool(USER, "search_crm_leads", { q: "bar", stage: "new", minScore: 50, limit: 5 });
    expect(r.isError).toBe(false);
    const where = db.lead.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(where.stage).toBe("new");
    expect(where.score).toEqual({ gte: 50 });
    expect(where.OR).toBeDefined();
    expect(db.lead.findMany.mock.calls[0][0].take).toBe(5);
    const data = JSON.parse(r.content);
    expect(data.totalLeadsInCrm).toBe(12);
    expect(data.leads[0]).toMatchObject({ id: "l1", stageLabel: "Nuovo", hasPhone: true });
    expect(r.action.write).toBe(false);
  });

  it("rifiuta input non validi senza toccare il DB", async () => {
    const r = await executeCrmTool(USER, "search_crm_leads", { stage: "inesistente" });
    expect(r.isError).toBe(true);
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });
});

describe("get_lead_details", () => {
  it("non espone lead di altri utenti", async () => {
    db.lead.findFirst.mockResolvedValue(null);
    const r = await executeCrmTool(USER, "get_lead_details", { leadId: "altrui" });
    expect(db.lead.findFirst.mock.calls[0][0].where).toEqual({ id: "altrui", userId: USER });
    expect(r.isError).toBe(true);
  });

  it("restituisce scheda e attività senza campi interni", async () => {
    db.lead.findFirst.mockResolvedValue({
      id: "l1", userId: USER, name: "Bar Centrale", stage: "qualified", position: 3, briefing: "{}", scoreReason: '{"summary":"ok","factors":[]}',
      activities: [{ type: "note", content: "Ciao", dueAt: null, done: false, createdAt: NOW }],
    });
    const r = await executeCrmTool(USER, "get_lead_details", { leadId: "l1" });
    const data = JSON.parse(r.content);
    expect(data.userId).toBeUndefined();
    expect(data.position).toBeUndefined();
    expect(data.hasBriefing).toBe(true);
    expect(data.scoreReason.summary).toBe("ok");
    expect(data.stageLabel).toBe("Qualificato");
    expect(r.action.leadId).toBe("l1");
  });
});

describe("list_due_followups", () => {
  it("marca gli scaduti e limita all'utente", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1", name: "A", category: null, city: null, stage: "contacted", score: null, phone: null, nextFollowUp: new Date("2026-11-20T12:00:00Z") }]);
    db.activity.findMany.mockResolvedValue([{ id: "a1", type: "task", content: "Richiamare", dueAt: new Date("2026-11-28T12:00:00Z"), lead: { id: "l2", name: "B" } }]);
    const r = await executeCrmTool(USER, "list_due_followups", { days: 3 }, NOW);
    const data = JSON.parse(r.content);
    expect(db.lead.findMany.mock.calls[0][0].where.userId).toBe(USER);
    expect(db.activity.findMany.mock.calls[0][0].where.userId).toBe(USER);
    expect(data.followups[0].overdue).toBe(true);
    expect(data.openTasks[0].overdue).toBe(false);
  });
});

describe("add_activity", () => {
  it("crea un promemoria e aggiorna il prossimo follow-up", async () => {
    db.lead.findFirst.mockResolvedValue({ id: "l1", name: "Bar Centrale", nextFollowUp: null });
    db.activity.create.mockResolvedValue({ id: "a1", type: "task", content: "Richiamare", dueAt: new Date("2026-11-28T12:00:00Z") });
    const r = await executeCrmTool(USER, "add_activity", { leadId: "l1", type: "task", content: "Richiamare", dueAt: "2026-11-28" });
    expect(r.isError).toBe(false);
    expect(db.activity.create.mock.calls[0][0].data).toMatchObject({ userId: USER, leadId: "l1", type: "task", dueAt: new Date("2026-11-28T12:00:00.000Z") });
    expect(db.lead.updateMany).toHaveBeenCalledWith({ where: { id: "l1", userId: USER }, data: { nextFollowUp: new Date("2026-11-28T12:00:00.000Z") } });
    expect(r.action).toMatchObject({ write: true, ok: true, leadId: "l1" });
  });

  it("rifiuta date non valide e lead altrui", async () => {
    db.lead.findFirst.mockResolvedValueOnce({ id: "l1", name: "X", nextFollowUp: null });
    const bad = await executeCrmTool(USER, "add_activity", { leadId: "l1", type: "task", content: "x", dueAt: "domani forse" });
    expect(bad.isError).toBe(true);
    db.lead.findFirst.mockResolvedValueOnce(null);
    const other = await executeCrmTool(USER, "add_activity", { leadId: "l9", type: "note", content: "x" });
    expect(other.isError).toBe(true);
    expect(other.action.write).toBe(true);
    expect(db.activity.create).not.toHaveBeenCalled();
  });
});

describe("update_lead_stage", () => {
  it("sposta il lead in coda alla nuova colonna e registra l'attività", async () => {
    db.lead.findFirst.mockResolvedValue({ id: "l1", name: "Bar Centrale", stage: "contacted" });
    db.lead.aggregate.mockResolvedValue({ _max: { position: 4 } });
    const r = await executeCrmTool(USER, "update_lead_stage", { leadId: "l1", stage: "lost", lostReason: "Prezzo" });
    expect(r.isError).toBe(false);
    expect(db.lead.updateMany.mock.calls[0][0]).toEqual({ where: { id: "l1", userId: USER }, data: { stage: "lost", position: 5, lostReason: "Prezzo" } });
    expect(db.activity.create.mock.calls[0][0].data).toMatchObject({ userId: USER, leadId: "l1", type: "stage" });
    expect(r.action.label).toContain("Contattato → Perso");
  });

  it("non fa nulla se la fase è già quella", async () => {
    db.lead.findFirst.mockResolvedValue({ id: "l1", name: "Bar Centrale", stage: "won" });
    const r = await executeCrmTool(USER, "update_lead_stage", { leadId: "l1", stage: "won" });
    expect(JSON.parse(r.content).unchanged).toBe(true);
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });
});

describe("robustezza", () => {
  it("tool sconosciuto ed eccezioni diventano risultati di errore", async () => {
    expect((await executeCrmTool(USER, "drop_table", {})).isError).toBe(true);
    db.lead.findMany.mockRejectedValue(new Error("db down"));
    db.lead.count.mockResolvedValue(0);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await executeCrmTool(USER, "search_crm_leads", {});
    expect(r.isError).toBe(true);
    spy.mockRestore();
  });

  it("parseDue interpreta date solo-giorno e ISO", () => {
    expect(parseDue("2026-12-01")?.toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(parseDue("2026-12-01T08:30:00Z")?.toISOString()).toBe("2026-12-01T08:30:00.000Z");
    expect(parseDue("boh")).toBeNull();
    expect(parseDue(undefined)).toBeNull();
  });
});
