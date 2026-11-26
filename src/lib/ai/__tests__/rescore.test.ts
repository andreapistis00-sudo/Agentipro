import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Database SQLite temporaneo: il ricalcolo dei totali si verifica sul motore vero.
const tmp = vi.hoisted(() => {
  const file = `${process.env.TMPDIR || "/tmp"}/agentipro-rescore-${process.pid}-${Date.now()}.db`;
  return { file, url: `file:${file}` };
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: tmp.url }) };
});

import { db } from "@/lib/db";
import { finalizeScore, recomputeTotals } from "../score";
import { DEFAULT_WEIGHTS, DIMENSION_IDS } from "../scoring";

beforeAll(() => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: tmp.url }, stdio: "pipe" });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  for (const f of [tmp.file, `${tmp.file}-journal`]) rmSync(f, { force: true });
});

const out = (v: Partial<Record<string, number>>) => ({
  dimensions: Object.fromEntries(DIMENSION_IDS.map((id) => [id, { score: v[id] ?? 50, reason: ` motivo  ${id} ` }])) as never,
  confidence: "media" as const,
  summary: " Sintesi. ",
  factors: [{ label: "A", impact: "+" as const, detail: "b" }],
});

describe("punteggio pesato", () => {
  it("finalizeScore limita i sotto-punteggi e calcola il totale in codice", () => {
    const r = finalizeScore(out({ fit: 140, size: -5 }), DEFAULT_WEIGHTS, true);
    expect(r.breakdown.dimensions.fit.score).toBe(100);
    expect(r.breakdown.dimensions.size.score).toBe(0);
    expect(r.breakdown.dimensions.fit.reason).toBe("motivo fit");
    expect(r.reason).toEqual({ summary: "Sintesi.", factors: [{ label: "A", impact: "+", detail: "b" }], demo: true });
    expect(r.score).toBe(Math.round((100 * 5 + 0 * 3 + 50 * 3 + 50 * 2 + 50 * 3 + 50 * 1) / 17));
  });

  it("recomputeTotals aggiorna solo i lead dell'utente con breakdown, senza AI", async () => {
    const u = await db.user.create({ data: { email: `r-${Date.now()}@example.test`, name: "T", passwordHash: "x" } });
    const other = await db.user.create({ data: { email: `o-${Date.now()}@example.test`, name: "O", passwordHash: "x" } });
    const a = finalizeScore(out({ fit: 100, proximity: 0 }), DEFAULT_WEIGHTS, false);
    const la = await db.lead.create({ data: { userId: u.id, name: "A", score: a.score, scoreBreakdown: JSON.stringify(a.breakdown) } });
    const legacy = await db.lead.create({ data: { userId: u.id, name: "Vecchio", score: 77 } });
    const foreign = await db.lead.create({ data: { userId: other.id, name: "Altrui", score: a.score, scoreBreakdown: JSON.stringify(a.breakdown) } });

    const zero = { fit: 0, size: 0, reputation: 0, presence: 0, proximity: 0, data: 0 };
    expect(await recomputeTotals(u.id, { ...zero, proximity: 5 })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: la.id } })).score).toBe(0);
    expect((await db.lead.findUniqueOrThrow({ where: { id: legacy.id } })).score).toBe(77);
    expect((await db.lead.findUniqueOrThrow({ where: { id: foreign.id } })).score).toBe(a.score);

    expect(await recomputeTotals(u.id, { ...zero, fit: 5 })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: la.id } })).score).toBe(100);
    expect(await recomputeTotals(u.id, { ...zero, fit: 5 })).toBe(0); // già allineati
  });
});
