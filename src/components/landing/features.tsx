import { Lock, Smartphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, H2, Kicker } from "./shared";
import { Reveal } from "./reveal";
import { ChatMock, PipelineMock, ResearchMock, ScoreMock, SearchMock } from "./mockups";

type Feature = {
  id: string;
  tag: string;
  title: React.ReactNode;
  body: string;
  facts: string[];
  mock: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "trova",
    tag: "Trova clienti",
    title: <>Scrivi «bar», scegli la città. <em className="italic text-ink-2">Ecco le attività della zona.</em></>,
    body: "Cerchi per categoria, città e raggio e ottieni l'elenco delle attività reali della zona, da OpenStreetMap e, se vuoi, da Google Places: telefono, sito, orari, distanza da te. Quelle che ti interessano finiscono nel CRM con un clic, senza doppioni.",
    facts: ["Attività reali, non elenchi comprati", "Raggio a scelta", "Zero copia-incolla"],
    mock: <SearchMock />,
  },
  {
    id: "scheda",
    tag: "Scheda AI",
    title: <>Quello che il web sa di un&apos;attività, <em className="italic text-ink-2">in una scheda sola.</em></>,
    body: "Con un clic l'AI cerca sito, schede su Google, TripAdvisor e PagineGialle, social e notizie. Ottieni cosa fa l'attività, orari e sedi, titolari citati pubblicamente, cosa dicono le recensioni nel bene e nel male, fatti recenti e segnali utili. Ogni informazione ha la sua fonte; quello che non si trova resta tra le cose da verificare.",
    facts: ["Una fonte per ogni dato", "Recensioni: pro e contro", "Recapiti da salvare in scheda"],
    mock: <ResearchMock />,
  },
  {
    id: "score",
    tag: "Punteggio AI",
    title: <>Un punteggio da 0 a 100, <em className="italic text-ink-2">con i tuoi criteri.</em></>,
    body: "Ogni cliente è valutato su sei dimensioni: aderenza a ciò che vendi, dimensione, reputazione, presenza online, vicinanza al tuo territorio e completezza dei dati. Scrivi con parole tue cosa conta e regola il peso di ogni dimensione: il totale è la media pesata e si ricalcola subito su tutti i clienti.",
    facts: ["Sei dimensioni", "Pesi regolabili", "Una motivazione per ogni voce"],
    mock: <ScoreMock />,
  },
  {
    id: "assistente",
    tag: "Assistente",
    title: <>Chiedi al tuo CRM <em className="italic text-ink-2">come lo chiederesti a voce.</em></>,
    body: "Una chat che conosce clienti, note e punteggi e sa cercare sul web. «Cosa sai della Pasticceria Rinaldi?», «Quali clienti in Trattativa non sento da due settimane?», «Confronta i miei cinque clienti con il punteggio più alto». Su richiesta registra note e promemoria.",
    facts: ["Conosce clienti e note", "Cerca sul web, con le fonti", "Note e promemoria"],
    mock: <ChatMock />,
  },
  {
    id: "pipeline",
    tag: "CRM e pipeline",
    title: <>La pipeline, <em className="italic text-ink-2">finalmente fuori dal taccuino.</em></>,
    body: "Nuovo, Contattato, Qualificato, Trattativa, Vinto o Perso: sposti le schede trascinandole. Note, attività e promemoria restano attaccati al cliente. Vedi quanto vale la pipeline, esporti in CSV quando vuoi e ogni mattina trovi la tua pagina «Oggi».",
    facts: ["Drag & drop", "Promemoria e attività", "Export CSV"],
    mock: <PipelineMock />,
  },
];

const EXTRAS = [
  { icon: Users, h: "Multi-utente", p: "Ogni agente ha il suo account e vede solo i suoi clienti. Comodo anche per le agenzie." },
  { icon: Smartphone, h: "Dal telefono", p: "In macchina, al bar, in sala d'attesa. Basta il browser, niente da installare." },
  { icon: Lock, h: "I dati sono tuoi", p: "Clienti, note e trattative restano tuoi. Li esporti in CSV quando vuoi." },
];

export function Features() {
  return (
    <section id="funzioni" aria-labelledby="lp-feat-title" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Kicker n="02">Cosa fa</Kicker>
            <H2 id="lp-feat-title" className="mt-6 max-w-[14ch]">
              Cinque strumenti, <span className="italic text-accent">un solo posto.</span>
            </H2>
          </div>
          <p className="max-w-sm text-[16.5px] leading-relaxed text-ink-2 lg:pb-2">
            Ricerca, informazioni sul cliente, punteggio, assistente e CRM: dalla prima ricerca alla trattativa, senza saltare da un foglio Excel a una rubrica a un post-it.
          </p>
        </div>

        <div className="mt-20 space-y-24 sm:mt-28 sm:space-y-36">
          {FEATURES.map((f, i) => (
            <article key={f.id} aria-labelledby={`lp-f-${f.id}`} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <Reveal className={cn("lg:col-span-5", i % 2 === 1 && "lg:order-2 lg:col-start-8")}>
                <p className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                  <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span>{f.tag}</span>
                </p>
                <h3 id={`lp-f-${f.id}`} className="mt-5 font-display text-[clamp(2.1rem,3.6vw,3.25rem)] leading-[1] tracking-[-0.01em] text-balance">
                  {f.title}
                </h3>
                <p className="mt-5 text-[16px] leading-[1.7] text-ink-2">{f.body}</p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {f.facts.map((x) => (
                    <li key={x} className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2">{x}</li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.1} className={cn("min-w-0 lg:col-span-7", i % 2 === 1 && "lg:order-1 lg:col-start-1")}>
                {f.mock}
              </Reveal>
            </article>
          ))}
        </div>

        <ul className="mt-28 grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:mt-36 md:grid-cols-3">
          {EXTRAS.map(({ icon: Icon, h, p }) => (
            <li key={h} className="bg-bg p-7 sm:p-8">
              <p className="flex items-center gap-2.5 font-display text-[26px] leading-none">
                <Icon className="h-[18px] w-[18px] text-accent" strokeWidth={2} aria-hidden />
                {h}
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{p}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
