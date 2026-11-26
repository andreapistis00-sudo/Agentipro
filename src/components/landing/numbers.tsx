import { Container, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";

const NUMBERS = [
  { v: "6", u: "ore", l: "a settimana recuperate tra ricerca, preparazione delle visite ed email." },
  { v: "10", u: "min", l: "per mappare una zona nuova, invece di un pomeriggio passato su Google." },
  { v: "2×", u: "", l: "visite preparate sul serio, a parità di chilometri percorsi." },
  { v: "0", u: "", l: "clienti persi tra post-it, rubrica del telefono e taccuino." },
];

export function Numbers() {
  return (
    <section aria-labelledby="lp-num-title" className="bg-ink py-24 text-bg sm:py-32">
      <Container>
        <Kicker n="03" className="text-bg/55">Il conto della serva</Kicker>
        <H2 id="lp-num-title" className="mt-6 max-w-[18ch]">
          Facciamo due conti. <span className="italic text-bg/60">Alla buona, come al bar.</span>
        </H2>

        <dl className="mt-16 grid gap-px overflow-hidden rounded-[20px] bg-bg/15 sm:grid-cols-2 lg:grid-cols-4">
          {NUMBERS.map((n, i) => (
            <Reveal key={n.l} delay={i * 0.08} className="flex flex-col-reverse justify-end bg-ink p-7 sm:p-8">
              <dt className="mt-4 text-[14.5px] leading-relaxed text-bg/70">{n.l}</dt>
              <dd className="flex items-baseline gap-2 font-display leading-[0.85]">
                <span className="text-[clamp(4.5rem,8vw,6.5rem)] tracking-[-0.03em]">{n.v}</span>
                {n.u && <span className="text-[28px] italic text-accent">{n.u}</span>}
              </dd>
            </Reveal>
          ))}
        </dl>
        <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-bg/50">
          Stime indicative su uno scenario tipo: agente plurimandatario, circa 40 visite a settimana. I tuoi numeri dipendono da settore, zona e abitudini.
        </p>

        <Reveal className="mt-20 grid gap-8 border-t border-bg/15 pt-14 lg:grid-cols-[auto_1fr] lg:gap-16">
          <span className="font-display text-[120px] leading-[0.6] text-accent" aria-hidden>«</span>
          <figure>
            <blockquote className="font-display text-[clamp(1.9rem,3.6vw,3.2rem)] leading-[1.1] tracking-[-0.01em] text-balance">
              Prima il lunedì lo passavo a cercare nomi e numeri. Adesso il lunedì <span className="italic text-accent">vendo</span>.
            </blockquote>
            <figcaption className="mt-6 font-mono text-[12px] text-bg/55">
              Marco, agente Horeca — scenario tipo, non una testimonianza reale
            </figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  );
}
