import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGNUP_CREDITS, creditCost, creditPacks } from "@/lib/credits";
import { Container, CtaLink, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";

const eur = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const num = (n: number) => new Intl.NumberFormat("it-IT").format(n);
const credits = (n: number) => (n === 1 ? "1 credito" : `${num(n)} crediti`);

type Plan = { name: string; price: string; per: string; pitch: string; items: string[]; cta: string; featured: boolean };

function plans(): Plan[] {
  const cost = { score: creditCost("score"), chat: creditCost("chat"), briefing: creditCost("briefing") };
  const uses = (n: number) => [
    `${num(Math.floor(n / Math.max(1, cost.score)))} clienti valutati con l'AI`,
    `oppure ${num(Math.floor(n / Math.max(1, cost.chat)))} messaggi all'assistente`,
    `oppure ${num(Math.floor(n / Math.max(1, cost.briefing)))} Schede AI sui clienti`,
  ];
  const packs = creditPacks();
  return [
    {
      name: "Gratis",
      price: "0 €",
      per: `${SIGNUP_CREDITS} crediti per iniziare`,
      pitch: "Per capire se fa per te, senza fretta e senza carta.",
      items: [...uses(SIGNUP_CREDITS), "Ricerca, CRM e pipeline sempre gratis"],
      cta: "Inizia gratis",
      featured: false,
    },
    ...packs.map((p) => ({
      name: `${num(p.credits)} crediti`,
      price: eur(p.priceCents),
      per: "una tantum",
      pitch: `${(p.priceCents / p.credits).toLocaleString("it-IT", { maximumFractionDigits: 1 })} cent a credito. Nessun abbonamento, non scadono.`,
      items: [...uses(p.credits), "Pagamento sicuro con Stripe"],
      cta: "Crea l'account",
      featured: p.featured,
    })),
  ];
}

export function Pricing({ loggedIn }: { loggedIn: boolean }) {
  const PLANS = plans();
  const cost = { score: creditCost("score"), chat: creditCost("chat"), briefing: creditCost("briefing") };
  return (
    <section id="prezzi" aria-labelledby="lp-price-title" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Kicker n="05">Prezzi</Kicker>
            <H2 id="lp-price-title" className="mt-6">
              Si prova gratis. <span className="italic text-ink-2">Si ricarica quando serve.</span>
            </H2>
            <p className="mt-6 max-w-2xl text-[15.5px] leading-[1.7] text-ink-2">
              Niente abbonamento: le funzioni AI usano crediti. Un punteggio costa {credits(cost.score)}, un messaggio
              all&apos;assistente {credits(cost.chat)}, una Scheda AI {credits(cost.briefing)}. Ricerca clienti,
              CRM e pipeline non consumano nulla.
            </p>
          </div>
          <p className="font-mono text-[11.5px] text-ink-3 lg:pb-3">Ricariche una tantum · pagamento con Stripe</p>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PLANS.map((p, i) => (
            <Reveal
              as="li"
              key={p.name}
              delay={i * 0.08}
              className={cn(
                "relative flex flex-col rounded-[22px] border p-7 sm:p-8",
                p.featured ? "border-ink bg-ink text-bg shadow-[var(--shadow-md)] lg:-my-4 lg:py-12" : "border-line bg-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[30px] leading-none">{p.name}</h3>
                {p.featured && <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent-ink">Più scelto</span>}
              </div>
              <p className={cn("mt-3 text-[14.5px]", p.featured ? "text-bg/70" : "text-ink-2")}>{p.pitch}</p>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-[56px] leading-none tracking-[-0.02em]">{p.price}</span>
                <span className={cn("text-[13.5px]", p.featured ? "text-bg/60" : "text-ink-3")}>{p.per}</span>
              </p>
              <ul className={cn("mt-8 flex-1 space-y-3 border-t pt-6 text-[14.5px]", p.featured ? "border-bg/15" : "border-line")}>
                {p.items.map((it) => (
                  <li key={it} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
              <CtaLink
                href={loggedIn ? "/app" : "/register"}
                variant={p.featured ? "accent" : "outline"}
                size="lg"
                className="mt-9 w-full"
              >
                {loggedIn ? "Vai all'app" : p.cta}
              </CtaLink>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
