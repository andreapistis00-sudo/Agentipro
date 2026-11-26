import { Container, CtaLink } from "./shared";
import { RouteMap } from "./route-map";

const CATEGORIES = [
  "bar", "parrucchieri", "studi dentistici", "ferramenta", "farmacie", "enoteche", "palestre", "autofficine",
  "ristoranti", "centri estetici", "panifici", "ottici", "hotel", "studi veterinari", "tabaccherie", "fioristi",
];

export function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section aria-labelledby="lp-hero-title" className="relative">
      <Container className="grid items-center gap-14 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1fr_1fr] lg:gap-12 xl:gap-14 lg:pb-24 lg:pt-14">
        <div>
          <p className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            CRM con AI per agenti di commercio
          </p>
          <h1 id="lp-hero-title" className="mt-7 font-display text-[clamp(4rem,8vw,6.6rem)] leading-[0.88] tracking-[-0.025em]">
            Meno giri <br />a vuoto.
            <span className="mt-1 block italic text-accent">Più strette <br />di mano.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-[17px] leading-[1.6] text-ink-2 sm:text-[19px]">
            Agentipro trova le attività della tua zona, ti dice <span className="text-ink">chi chiamare per primo</span> e
            ti prepara un <span className="text-ink">briefing prima di ogni visita</span>. Tu pensi a vendere. Al resto ci pensa lui.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {loggedIn ? (
              <CtaLink href="/app" size="lg">Vai all&apos;app</CtaLink>
            ) : (
              <CtaLink href="/register" size="lg">Prova gratis</CtaLink>
            )}
            <CtaLink href="#giornata" variant="outline" size="lg" arrow={false}>Guarda una giornata tipo</CtaLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11.5px] text-ink-3">
            {["Gratis per iniziare", "Nessuna carta richiesta", "Va benissimo dal telefono"].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-[600px] lg:max-w-none xl:pl-4">
          <RouteMap />
        </div>
      </Container>

      {/* Nastro delle categorie */}
      <div className="border-y border-line bg-surface/60">
        <div className="mx-auto flex max-w-[1440px] items-center">
          <p className="hidden shrink-0 border-r border-line px-[var(--lp-gutter)] py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3 md:block">
            Chi cerchi oggi?
          </p>
          <div className="lp-marquee min-w-0 flex-1 overflow-hidden py-4" aria-label="Esempi di categorie che puoi cercare">
            <div className="lp-marquee-track flex w-max">
              {[0, 1].map((k) => (
                <ul key={k} className="flex shrink-0 items-center" aria-hidden={k === 1}>
                  {CATEGORIES.map((c) => (
                    <li key={c} className="flex items-center whitespace-nowrap font-display text-[28px] italic leading-none text-ink-2 sm:text-[34px]">
                      <span className="px-5">{c}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
