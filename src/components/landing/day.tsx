import { Container, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";

const ENTRIES = [
  { t: "07:45", h: "Caffè al banco, giro già pronto.", p: "Apri «Oggi»: tre richiami in scadenza, due trattative calde e le visite in ordine di strada. Lo leggi prima che arrivi la brioche." },
  { t: "08:30", h: "Venti parrucchieri nuovi in dieci minuti.", p: "Cerchi «parrucchieri, Desenzano, 8 km». Arrivano nomi, telefoni, orari e distanza. Salvi i sei che ti interessano con un clic ciascuno." },
  { t: "09:15", h: "Chiami prima chi vale di più.", p: "Ogni lead ha il suo punteggio. Parti dal 91: lo Studio Ferri ha appena aperto la seconda sede. Il 38 può aspettare venerdì." },
  { t: "11:40", h: "Parcheggiato davanti, briefing in mano.", p: "Due minuti in macchina: cosa fa l'attività, la frase per rompere il ghiaccio, le obiezioni probabili e cosa rispondere. Entri sapendo dove vuoi arrivare." },
  { t: "13:10", h: "Pranzo. L'email l'ha scritta lui.", p: "«Manda a Rinaldi il riepilogo dell'offerta con lo sconto dell'8%.» Rileggi, cambi una parola, invii. Il primo è ancora caldo." },
  { t: "16:30", h: "«Costa troppo.» Lo sapevi già.", p: "L'obiezione era nel briefing, con la risposta. La trattativa si sposta di una colonna: basta trascinarla." },
  { t: "18:45", h: "Ultima nota, prima di ripartire.", p: "Scrivi com'è andata, metti il promemoria per giovedì. La pipeline si aggiorna da sola: 14.200 € aperti." },
  { t: "19:30", h: "A casa. Il giro di domani è già lì.", p: "" },
];

const ODOMETER = [
  ["62", "km"],
  ["9", "visite"],
  ["6", "lead nuovi"],
  ["0", "post-it"],
];

export function Day() {
  return (
    <section id="giornata" aria-labelledby="lp-day-title" className="scroll-mt-20 py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Kicker n="01">Una giornata con Agentipro</Kicker>
          <H2 id="lp-day-title" className="mt-6">
            Martedì. <span className="italic text-ink-2">Dall&apos;espresso all&apos;ultima nota.</span>
          </H2>
          <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-ink-2">
            Una giornata qualsiasi, quando la ricerca, la preparazione e le scartoffie le fa qualcun altro. Tu guidi, parli, chiudi.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-4 divide-x divide-line rounded-2xl border border-line bg-surface">
            {ODOMETER.map(([v, l]) => (
              <div key={l} className="flex flex-col-reverse px-2 py-4 text-center">
                <dt className="mt-2 text-[11.5px] text-ink-3">{l}</dt>
                <dd className="font-mono text-[26px] font-medium tabular-nums leading-none">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 font-mono text-[11px] text-ink-3">Scenario illustrativo</p>
        </div>

        <Reveal>
          <div className="relative overflow-hidden rounded-[20px] border border-line shadow-[var(--shadow-md)]">
            <div className="lp-ruled relative [--lp-margin:64px] sm:[--lp-margin:96px]">
              <div className="flex h-16 items-end justify-end border-b border-line px-6 pb-3">
                <p className="font-display text-[22px] italic text-ink-2">martedì 24 novembre</p>
              </div>
              <ol className="pb-8 pt-8">
                {ENTRIES.map((e, i) => (
                  <Reveal as="li" key={e.t} delay={Math.min(i * 0.04, 0.2)} y={12} className="grid grid-cols-[var(--lp-margin)_1fr] pb-8 last:pb-0">
                    <p className="pr-3 text-right font-mono text-[12px] leading-[32px] text-accent sm:pr-5 sm:text-[13px]">
                      <time>{e.t}</time>
                    </p>
                    <div className="pl-4 pr-5 sm:pl-6 sm:pr-10">
                      <h3 className="font-display text-[23px] leading-[32px] sm:text-[27px]">{e.h}</h3>
                      {e.p && <p className="text-[15px] leading-[32px] text-ink-2">{e.p}</p>}
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
