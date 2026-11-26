import "server-only";
// Pagamenti con Stripe Checkout per la ricarica dei crediti.
import Stripe from "stripe";
import { addCredits } from "@/lib/credits";

/** I pagamenti sono attivi solo con STRIPE_SECRET_KEY. */
export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

let _stripe: Stripe | null = null;
/** Client creato al primo uso (la chiave può mancare in fase di build). */
export function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), { appInfo: { name: "Agentipro" } });
  return _stripe;
}

/** URL pubblico dell'app, per gli URL di ritorno da Checkout. */
export function appUrl(req?: Request) {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  return req ? new URL(req.url).origin : "http://localhost:3000";
}

export type FulfillResult =
  | { status: "credited"; credits: number; balance: number }
  | { status: "already"; credits: number; balance: number }
  | { status: "unpaid" }
  | { status: "invalid"; reason: string };

/**
 * Accredita i crediti di una Checkout Session pagata, in modo idempotente (stesso `stripeSessionId` → un solo accredito).
 * Usata dal webhook e, come rete di sicurezza, dalla pagina di ritorno. Con `expectedUserId` la sessione deve appartenere a quell'utente.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session, expectedUserId?: string): Promise<FulfillResult> {
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits);
  if (!userId || !Number.isInteger(credits) || credits <= 0) return { status: "invalid", reason: "metadati mancanti" };
  if (expectedUserId && userId !== expectedUserId) return { status: "invalid", reason: "sessione di un altro utente" };
  if (session.mode !== "payment" || session.payment_status !== "paid") return { status: "unpaid" };
  const res = await addCredits(userId, credits, "topup", session.id);
  return { status: res.added ? "credited" : "already", credits, balance: res.balance };
}
