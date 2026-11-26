import { Container, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";

const STEPS = [
  { h: "Racconta cosa vendi", p: "Prodotti, zona, cliente ideale, il tuo modo di parlare. Lo fai una volta: da lì l'AI calibra punteggi, briefing e messaggi.", m: "≈ 5 minuti, una volta sola" },
  { h: "Cerca la tua zona", p: "Categoria, città, raggio. Salvi le attività che ti interessano e le ritrovi nel CRM già ordinate per punteggio.", m: "≈ 10 minuti per zona" },
  { h: "Esci con il giro pronto", p: "Briefing, piano visite, promemoria. Dopo ogni visita una nota veloce, e la pipeline si tiene in ordine da sola.", m: "ogni mattina" },
];

export function How() {
  return (
    <section id="come-funziona" aria-labelledby="lp-how-title" className="scroll-mt-20 py-24 sm:py-32">
      <Container>
        <Kicker n="04">Come funziona</Kicker>
        <H2 id="lp-how-title" className="mt-6">
          Tre passi. <span className="italic text-ink-2">Il quarto è la firma.</span>
        </H2>

        <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          <svg className="pointer-events-none absolute left-0 right-0 top-[46px] hidden h-6 w-full md:block" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden>
            <path d="M60 12 C 200 -4 300 28 420 12 S 600 -4 700 12" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 8" vectorEffect="non-scaling-stroke" />
          </svg>
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.h} delay={i * 0.12} className="relative grid grid-cols-[auto_1fr] gap-x-5 md:block">
              <span className="relative row-span-3 inline-grid h-16 w-16 place-items-center rounded-full border border-line-strong bg-bg font-display text-[38px] leading-none md:h-[92px] md:w-[92px] md:text-[56px]">
                {i + 1}
              </span>
              <h3 className="mt-2 font-display md:mt-7 text-[28px] leading-[1.05] md:text-[32px]">{s.h}</h3>
              <p className="mt-3 max-w-sm text-[15.5px] leading-relaxed text-ink-2">{s.p}</p>
              <p className="mt-5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-accent">{s.m}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
