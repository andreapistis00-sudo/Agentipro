import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCheckoutSession, stripe, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — eventi Stripe firmati (STRIPE_WEBHOOK_SECRET).
 * Su `checkout.session.completed` (e `checkout.session.async_payment_succeeded`) con pagamento riuscito
 * accredita i crediti in modo idempotente.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripeEnabled() || !secret) return NextResponse.json({ error: "Webhook non configurato" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Firma mancante" }, { status: 400 });

  // Il corpo va letto RAW: la firma è calcolata sui byte esatti inviati da Stripe.
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.warn("[stripe/webhook] firma non valida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    try {
      const res = await fulfillCheckoutSession(session);
      if (res.status === "invalid") console.warn("[stripe/webhook] sessione ignorata:", session.id, res.reason);
    } catch (err) {
      console.error("[stripe/webhook] accredito non riuscito:", session.id, err);
      // Utente eliminato nel frattempo: nessun nuovo tentativo utile.
      if (err instanceof Error && "code" in err && err.code === "P2025") return NextResponse.json({ received: true });
      return NextResponse.json({ error: "Accredito non riuscito" }, { status: 500 }); // Stripe ritenterà
    }
  }
  return NextResponse.json({ received: true });
}
