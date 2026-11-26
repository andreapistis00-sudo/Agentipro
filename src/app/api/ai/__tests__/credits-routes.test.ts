import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const USER = { id: "u1", name: "Mario", email: "m@example.test", company: null, sector: null, products: null, idealCustomer: null, territory: null, tone: null, credits: 50 };
const m = vi.hoisted(() => ({
  demo: false,
  chargeForAi: vi.fn(),
  refundCredits: vi.fn(),
  scoreLeads: vi.fn(),
  runChat: vi.fn(),
  generateBriefing: vi.fn(),
  db: {
    lead: { count: vi.fn(), findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: async () => USER }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/ai", () => ({ isAiDemo: () => m.demo }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), aiRateLimit: () => null }));
vi.mock("@/lib/ai/score", () => ({ scoreLeads: m.scoreLeads }));
vi.mock("@/lib/ai/chat", () => ({ runChat: m.runChat, userRaw: (s: string) => s }));
vi.mock("@/lib/ai/briefing", () => ({ generateBriefing: m.generateBriefing, loadLeadForBriefing: async () => ({ id: "l1", name: "Bar" }) }));
vi.mock("@/lib/credits", async (orig) => ({
  ...(await orig<typeof import("@/lib/credits")>()),
  chargeForAi: m.chargeForAi,
  refundCredits: m.refundCredits,
}));

import { POST as score } from "../score/route";
import { POST as chat } from "../chat/route";
import { POST as briefing } from "../briefing/route";

const post = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const noCredits = () => NextResponse.json({ error: "Crediti esauriti", code: "INSUFFICIENT_CREDITS", needed: 5, balance: 1 }, { status: 402 });

beforeEach(() => {
  vi.clearAllMocks();
  m.demo = false;
  m.refundCredits.mockResolvedValue(0);
  m.db.conversation.create.mockResolvedValue({ id: "c1", title: "Nuova conversazione", leadId: null });
  m.db.message.create.mockResolvedValue({ id: "msg1" });
});

describe("/api/ai/score e crediti", () => {
  it("addebita solo i lead esistenti e rimborsa quelli non valutati", async () => {
    m.db.lead.count.mockResolvedValue(3);
    m.chargeForAi.mockResolvedValue({ charged: 3 });
    m.scoreLeads.mockResolvedValue({ results: [{ leadId: "a", score: 80, summary: "" }], errors: [{ leadId: "b", error: "x" }, { leadId: "c", error: "y" }], demo: false });
    const res = await score(post({ leadIds: ["a", "b", "c", "a"] }));
    expect(res.status).toBe(200);
    expect(m.chargeForAi).toHaveBeenCalledWith("u1", "score", 3, false);
    expect(m.refundCredits).toHaveBeenCalledWith("u1", 2);
  });

  it("senza crediti risponde 402 senza chiamare l'AI", async () => {
    m.db.lead.count.mockResolvedValue(5);
    m.chargeForAi.mockResolvedValue(noCredits());
    const res = await score(post({ leadIds: ["a"] }));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(m.scoreLeads).not.toHaveBeenCalled();
  });
});

describe("/api/ai/chat e crediti", () => {
  it("valuta i crediti prima di aprire lo stream: 402 normale e nessuna conversazione creata", async () => {
    m.chargeForAi.mockResolvedValue(noCredits());
    const res = await chat(post({ message: "Ciao" }));
    expect(res.status).toBe(402);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(m.db.conversation.create).not.toHaveBeenCalled();
  });

  it("rimborsa se il turno fallisce per un errore", async () => {
    m.chargeForAi.mockResolvedValue({ charged: 2 });
    m.runChat.mockRejectedValue(new Error("API giù"));
    const res = await chat(post({ message: "Ciao" }));
    const text = await res.text();
    expect(text).toContain('"type":"error"');
    expect(m.refundCredits).toHaveBeenCalledWith("u1", 2);
  });

  it("non rimborsa un turno riuscito", async () => {
    m.chargeForAi.mockResolvedValue({ charged: 2 });
    m.runChat.mockResolvedValue(undefined);
    await (await chat(post({ message: "Ciao" }))).text();
    expect(m.refundCredits).not.toHaveBeenCalled();
  });
});

describe("/api/ai/briefing e crediti", () => {
  it("rimborsa se la generazione fallisce", async () => {
    m.chargeForAi.mockResolvedValue({ charged: 5 });
    m.generateBriefing.mockRejectedValue(new Error("boom"));
    await (await briefing(post({ leadId: "l1" }))).text();
    expect(m.chargeForAi).toHaveBeenCalledWith("u1", "briefing", 1, false);
    expect(m.refundCredits).toHaveBeenCalledWith("u1", 5);
  });

  it("senza crediti risponde 402 prima dello stream", async () => {
    m.chargeForAi.mockResolvedValue(noCredits());
    const res = await briefing(post({ leadId: "l1" }));
    expect(res.status).toBe(402);
    expect(m.generateBriefing).not.toHaveBeenCalled();
  });
});
