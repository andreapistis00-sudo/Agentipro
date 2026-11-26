import "server-only";
// Crediti AI: costi, pacchetti di ricarica e movimenti atomici sul saldo dell'utente.
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CreditReason = "signup" | "topup" | "score" | "chat" | "briefing" | "refund";
export type CreditFeature = "score" | "chat" | "briefing";

/** Crediti regalati a ogni nuovo utente (uguale al default di `User.credits`). */
export const SIGNUP_CREDITS = 50;
/** Sotto questa soglia l'app avvisa che i crediti stanno finendo. */
export const LOW_CREDITS = 10;

export const REASON_LABELS: Record<CreditReason, string> = {
  signup: "Crediti di benvenuto",
  topup: "Ricarica",
  score: "Punteggio AI",
  chat: "Messaggio all'assistente",
  briefing: "Briefing pre-visita",
  refund: "Rimborso (operazione AI non riuscita)",
};
export const reasonLabel = (r: string) => REASON_LABELS[r as CreditReason] ?? r;

function envInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Costo in crediti di un'azione AI (configurabile da env). Score: per lead · chat: per messaggio · briefing: per briefing. */
export function creditCost(feature: CreditFeature): number {
  switch (feature) {
    case "score":
      return envInt("CREDIT_COST_SCORE", 1);
    case "chat":
      return envInt("CREDIT_COST_CHAT", 2);
    case "briefing":
      return envInt("CREDIT_COST_BRIEFING", 5);
  }
}

export type CreditPack = { id: string; credits: number; priceCents: number; featured: boolean };

const DEFAULT_PACKS = "500:100,2000:500,5000:1500";

/**
 * Pacchetti di ricarica. `CREDIT_PACKS` = elenco "prezzoInCentesimi:crediti" separato da virgole
 * (default "500:100,2000:500,5000:1500" → 5 € = 100, 20 € = 500, 50 € = 1500). Il pacchetto centrale è evidenziato.
 */
export function creditPacks(): CreditPack[] {
  const parse = (spec: string) =>
    spec
      .split(",")
      .map((p) => p.trim().split(":").map((x) => Number(x.trim())))
      .filter(([price, credits]) => Number.isInteger(price) && Number.isInteger(credits) && price >= 50 && credits > 0)
      .map(([priceCents, credits]) => ({ priceCents, credits }));
  let packs = parse(process.env.CREDIT_PACKS ?? "");
  if (!packs.length) packs = parse(DEFAULT_PACKS);
  const seen = new Set<string>();
  const unique = packs.filter((p) => {
    const id = `pack-${p.credits}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const featured = unique.length >= 3 ? Math.floor((unique.length - 1) / 2) : -1;
  return unique.map((p, i) => ({ id: `pack-${p.credits}`, ...p, featured: i === featured }));
}

export const findPack = (id: string) => creditPacks().find((p) => p.id === id) ?? null;

/* ---------------------------------- Movimenti ---------------------------------- */

/**
 * Le transazioni interattive concorrenti su SQLite vanno in stallo (lock condivisi che non possono salire a scrittura):
 * i movimenti di crediti di questa istanza si eseguono quindi uno alla volta. L'UPDATE condizionale resta comunque
 * la garanzia che il saldo non scenda mai sotto zero.
 */
const g = globalThis as unknown as { __apCreditsQueue?: Promise<unknown> };
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__apCreditsQueue ?? Promise.resolve()).then(fn, fn);
  g.__apCreditsQueue = run.catch(() => undefined);
  return run;
}

export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS";
  constructor(readonly needed: number, readonly balance: number) {
    super("Crediti esauriti");
    this.name = "InsufficientCreditsError";
  }
}

export type ChargeResult = { ok: true; charged: number; balance: number } | { ok: false; needed: number; balance: number };

/**
 * Scala `amount` crediti in modo atomico: il decremento avviene solo se il saldo è sufficiente
 * (UPDATE condizionale), e nella stessa transazione si registra il movimento con il saldo risultante.
 */
export async function chargeCredits(userId: string, amount: number, reason: CreditReason): Promise<ChargeResult> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Importo non valido: ${amount}`);
  return serialized(() => db.$transaction(async (tx) => {
    if (amount === 0) {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
      return { ok: true as const, charged: 0, balance: u?.credits ?? 0 };
    }
    const updated = await tx.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    const u = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (updated.count === 0 || !u) return { ok: false as const, needed: amount, balance: u?.credits ?? 0 };
    await tx.creditTransaction.create({ data: { userId, amount: -amount, balanceAfter: u.credits, reason } });
    return { ok: true as const, charged: amount, balance: u.credits };
  }));
}

/** Come `chargeCredits`, ma lancia `InsufficientCreditsError` se il saldo non basta. */
export async function spendCredits(userId: string, amount: number, reason: CreditReason) {
  const res = await chargeCredits(userId, amount, reason);
  if (!res.ok) throw new InsufficientCreditsError(res.needed, res.balance);
  return res;
}

/** Restituisce crediti addebitati per un'operazione non riuscita. */
export async function refundCredits(userId: string, amount: number): Promise<number | null> {
  if (!Number.isInteger(amount) || amount <= 0) return null;
  try {
    return await serialized(() => db.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount } }, select: { credits: true } });
      await tx.creditTransaction.create({ data: { userId, amount, balanceAfter: u.credits, reason: "refund" } });
      return u.credits;
    }));
  } catch (err) {
    console.error("[credits] rimborso non riuscito", userId, amount, err);
    return null;
  }
}

export type AddResult = { added: boolean; balance: number };

/**
 * Accredita `amount` crediti. Con `stripeSessionId` è idempotente: la stessa Checkout Session accredita una volta sola
 * (vincolo unique su `CreditTransaction.stripeSessionId`, anche con webhook e pagina di ritorno in concorrenza).
 */
export async function addCredits(userId: string, amount: number, reason: CreditReason, stripeSessionId?: string): Promise<AddResult> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Importo non valido: ${amount}`);
  const current = async () => (await db.user.findUnique({ where: { id: userId }, select: { credits: true } }))?.credits ?? 0;
  if (stripeSessionId && (await db.creditTransaction.findUnique({ where: { stripeSessionId }, select: { id: true } }))) {
    return { added: false, balance: await current() };
  }
  try {
    const balance = await serialized(() => db.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount } }, select: { credits: true } });
      await tx.creditTransaction.create({ data: { userId, amount, balanceAfter: u.credits, reason, stripeSessionId: stripeSessionId ?? null } });
      return u.credits;
    }));
    return { added: true, balance };
  } catch (err) {
    // Accredito concorrente della stessa sessione: la transazione è stata annullata, il saldo è già corretto.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { added: false, balance: await current() };
    throw err;
  }
}

/* ---------------------------------- API ---------------------------------- */

/** Risposta 402 standard quando i crediti non bastano. */
export function insufficientCreditsResponse(needed: number, balance: number) {
  return NextResponse.json({ error: "Crediti esauriti", code: "INSUFFICIENT_CREDITS", needed, balance }, { status: 402 });
}

/**
 * Addebito prima di una chiamata AI reale. In modalità demo non scala nulla.
 * Restituisce la risposta 402 pronta se il saldo non basta, altrimenti quanto è stato addebitato.
 */
export async function chargeForAi(userId: string, feature: CreditFeature, units: number, demo: boolean): Promise<NextResponse | { charged: number }> {
  if (demo || units <= 0) return { charged: 0 };
  const res = await chargeCredits(userId, creditCost(feature) * units, feature);
  if (!res.ok) return insufficientCreditsResponse(res.needed, res.balance);
  return { charged: res.charged };
}
