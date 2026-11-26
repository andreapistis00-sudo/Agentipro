import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, CtaLink, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";

const PLANS = [
  {
    name: "Gratis",
    price: "0 €",
    per: "per sempre",
    pitch: "Per capire se fa per te, senza fretta.",
    items: ["Fino a 50 lead nel CRM", "10 ricerche al mese", "5 briefing al mese", "Pipeline, note e promemoria"],
    cta: "Inizia gratis",
    featured: false,
  },
  {
    name: "Pro",
    price: "29 €",
    per: "al mese",
    pitch: "Per chi vive in macchina e vende tutti i giorni.",
    items: ["Lead e ricerche illimitati", "Lead score su tutto il CRM", "Briefing e assistente senza limiti", "Ricerca web nei briefing", "Google Places (opzionale)", "Export CSV"],
    cta: "Prova Pro gratis",
    featured: true,
  },
  {
    name: "Team",
    price: "24 €",
    per: "a utente / mese",
    pitch: "Per agenzie e reti vendita, da 3 agenti.",
    items: ["Tutto quello che c'è in Pro", "Un account per ogni agente", "Dati separati per persona", "Assistenza prioritaria"],
    cta: "Parliamone",
    featured: false,
  },
];

export function Pricing({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section id="prezzi" aria-labelledby="lp-price-title" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Kicker n="05">Prezzi</Kicker>
            <H2 id="lp-price-title" className="mt-6">
              Si prova gratis. <span className="italic text-ink-2">Si paga quando rende.</span>
            </H2>
          </div>
          <p className="font-mono text-[11.5px] text-ink-3 lg:pb-3">Listino di esempio · prezzi indicativi, IVA esclusa</p>
        </div>

        <ul className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-5">
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
                <h3 className="font-display text-[34px] leading-none">{p.name}</h3>
                {p.featured && <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent-ink">Consigliato</span>}
              </div>
              <p className={cn("mt-3 text-[14.5px]", p.featured ? "text-bg/70" : "text-ink-2")}>{p.pitch}</p>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-[68px] leading-none tracking-[-0.02em]">{p.price}</span>
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
