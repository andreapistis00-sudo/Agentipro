import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Database SQLite temporaneo e dedicato: l'atomicità e il vincolo unique si verificano sul motore vero.
const tmp = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/agentipro-credits-${process.pid}-${Date.now()}.db`;
  return { file, url: `file:${file}` };
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: tmp.url }) };
});

import { db } from "@/lib/db";
import {
  InsufficientCreditsError, SIGNUP_CREDITS, addCredits, chargeCredits, chargeForAi, creditCost, creditPacks, refundCredits, spendCredits,
} from "../credits";

beforeAll(() => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: tmp.url }, stdio: "pipe" });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  for (const f of [tmp.file, `${tmp.file}-journal`]) rmSync(f, { force: true });
});

let n = 0;
async function newUser(credits?: number) {
  return db.user.create({
    data: { email: `u${n++}-${Date.now()}@example.test`, name: "Test", passwordHash: "x", ...(credits !== undefined && { credits }) },
  });
}
const balance = async (id: string) => (await db.user.findUniqueOrThrow({ where: { id } })).credits;
const txs = (userId: string) => db.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

describe("crediti: saldo iniziale e configurazione", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("un nuovo utente parte con 50 crediti (default dello schema)", async () => {
    const u = await newUser();
    expect(u.credits).toBe(50);
    expect(SIGNUP_CREDITS).toBe(50);
  });

  it("costi e pacchetti hanno default sensati e si configurano da env", () => {
    expect([creditCost("score"), creditCost("chat"), creditCost("briefing")]).toEqual([1, 2, 5]);
    expect(creditPacks().map((p) => [p.priceCents, p.credits, p.featured])).toEqual([[500, 100, false], [2000, 500, true], [5000, 1500, false]]);
    vi.stubEnv("CREDIT_COST_CHAT", "3");
    vi.stubEnv("CREDIT_COST_SCORE", "non-un-numero");
    vi.stubEnv("CREDIT_PACKS", "1000:200, 3000:800");
    expect(creditCost("chat")).toBe(3);
    expect(creditCost("score")).toBe(1);
    expect(creditPacks()).toEqual([
      { id: "pack-200", priceCents: 1000, credits: 200, featured: false },
      { id: "pack-800", priceCents: 3000, credits: 800, featured: false },
    ]);
  });
});

describe("chargeCredits", () => {
  it("scala il saldo e registra il movimento con il saldo risultante", async () => {
    const u = await newUser();
    const res = await chargeCredits(u.id, 5, "briefing");
    expect(res).toEqual({ ok: true, charged: 5, balance: 45 });
    expect(await balance(u.id)).toBe(45);
    const [t] = await txs(u.id);
    expect(t).toMatchObject({ amount: -5, balanceAfter: 45, reason: "briefing", stripeSessionId: null });
  });

  it("con saldo insufficiente non scala nulla e non registra movimenti", async () => {
    const u = await newUser(3);
    expect(await chargeCredits(u.id, 5, "briefing")).toEqual({ ok: false, needed: 5, balance: 3 });
    expect(await balance(u.id)).toBe(3);
    expect(await txs(u.id)).toHaveLength(0);
    await expect(spendCredits(u.id, 5, "briefing")).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it("è atomico: addebiti concorrenti non portano mai il saldo sotto zero", async () => {
    const u = await newUser(10);
    const results = await Promise.all(Array.from({ length: 8 }, () => chargeCredits(u.id, 2, "chat")));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(await balance(u.id)).toBe(0);
    const list = await txs(u.id);
    expect(list).toHaveLength(5);
    expect(list.map((t) => t.balanceAfter).sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 8]);
  });

  it("un utente inesistente risulta senza crediti", async () => {
    expect(await chargeCredits("nessuno", 1, "score")).toEqual({ ok: false, needed: 1, balance: 0 });
  });
});

describe("refundCredits", () => {
  it("restituisce i crediti con un movimento di rimborso", async () => {
    const u = await newUser();
    await chargeCredits(u.id, 4, "score");
    expect(await refundCredits(u.id, 3)).toBe(49);
    const list = await txs(u.id);
    expect(list.at(-1)).toMatchObject({ amount: 3, balanceAfter: 49, reason: "refund" });
    expect(await refundCredits(u.id, 0)).toBeNull(); // niente da rimborsare
    expect(await txs(u.id)).toHaveLength(2);
  });
});

describe("addCredits", () => {
  it("accredita una sola volta per la stessa Checkout Session", async () => {
    const u = await newUser();
    expect(await addCredits(u.id, 100, "topup", "cs_test_1")).toEqual({ added: true, balance: 150 });
    expect(await addCredits(u.id, 100, "topup", "cs_test_1")).toEqual({ added: false, balance: 150 });
    const list = await txs(u.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ amount: 100, balanceAfter: 150, reason: "topup", stripeSessionId: "cs_test_1" });
  });

  it("è idempotente anche con accrediti concorrenti (webhook + pagina di ritorno)", async () => {
    const u = await newUser();
    const res = await Promise.all([addCredits(u.id, 500, "topup", "cs_test_2"), addCredits(u.id, 500, "topup", "cs_test_2")]);
    expect(res.filter((r) => r.added)).toHaveLength(1);
    expect(await balance(u.id)).toBe(550);
    expect(await txs(u.id)).toHaveLength(1);
  });
});

describe("chargeForAi", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("in modalità demo non scala nulla", async () => {
    const u = await newUser();
    expect(await chargeForAi(u.id, "briefing", 1, true)).toEqual({ charged: 0 });
    expect(await balance(u.id)).toBe(50);
  });

  it("con l'AI reale addebita costo × unità, oppure risponde 402", async () => {
    const u = await newUser(12);
    expect(await chargeForAi(u.id, "score", 10, false)).toEqual({ charged: 10 });
    const res = await chargeForAi(u.id, "briefing", 1, false);
    expect(res).toBeInstanceOf(Response);
    const r = res as Response;
    expect(r.status).toBe(402);
    expect(await r.json()).toEqual({ error: "Crediti esauriti", code: "INSUFFICIENT_CREDITS", needed: 5, balance: 2 });
    expect(await balance(u.id)).toBe(2);
  });
});
