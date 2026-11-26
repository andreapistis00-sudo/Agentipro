import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { findPack } from "@/lib/credits";
import { appUrl, stripe, stripeEnabled } from "@/lib/stripe";
import { rateLimit, tooMany } from "@/lib/search/rate-limit";

export const runtime = "nodejs";

const Body = z.object({ packId: z.string().trim().min(1).max(40) });

/**
 * POST /api/credits/checkout — body { packId }.
 * Crea una Stripe Checkout Session per il pacchetto scelto e restituisce { url } a cui reindirizzare l'utente.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!stripeEnabled()) return NextResponse.json({ error: "Pagamenti non ancora attivi" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pacchetto mancante" }, { status: 400 });
  const pack = findPack(parsed.data.packId);
  if (!pack) return NextResponse.json({ error: "Pacchetto non disponibile" }, { status: 400 });
  const limit = rateLimit(`checkout:${user.id}`, 10, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec, `Troppi tentativi di pagamento. Riprova tra ${limit.retryAfterSec} secondi.`);

  const base = appUrl(req);
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: pack.priceCents,
            product_data: { name: `Agentipro – ${pack.credits} crediti`, description: "Crediti per le funzioni AI di Agentipro" },
          },
        },
      ],
      metadata: { userId: user.id, credits: String(pack.credits), packId: pack.id },
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${base}/app/credits?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/credits?canceled=1`,
      locale: "it",
    });
    if (!session.url) throw new Error("Checkout Session senza URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[credits/checkout]", err);
    return NextResponse.json({ error: "Non è stato possibile avviare il pagamento. Riprova tra poco." }, { status: 502 });
  }
}
