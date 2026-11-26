import { Plus } from "lucide-react";
import { Container, H2, Kicker } from "./shared";
import { SIGNUP_CREDITS, creditCost, creditPacks } from "@/lib/credits";

const cr = (n: number) => (n === 1 ? "1 credito" : `${n} crediti`);
const firstPack = creditPacks()[0];

export const FAQS = [
  {
    q: "Da dove arrivano le attività che trovo?",
    a: "Da OpenStreetMap, la mappa aperta e collaborativa: nomi, indirizzi, telefoni, siti e orari dove disponibili. Se attivi Google Places ottieni ancora più dettagli. Sono dati pubblici: prima di presentarti dai sempre un'occhiata veloce.",
  },
  {
    q: "Funziona anche in provincia, fuori dalle grandi città?",
    a: "Sì. Scegli la città e il raggio, da pochi chilometri a un'intera zona. La quantità di informazioni varia da posto a posto: dove i dati sono scarsi lo vedi subito, e puoi sempre aggiungere i clienti a mano.",
  },
  {
    q: "Come fa l'AI a sapere chi è un buon cliente per me?",
    a: "Glielo dici tu: cosa vendi, in che zona, chi è il tuo cliente ideale e, se vuoi, i tuoi criteri con parole tue. Il punteggio è diviso in sei dimensioni, ognuna con la sua motivazione e un peso che regoli tu; il totale è la media pesata, calcolata in modo trasparente.",
  },
  {
    q: "La Scheda AI può inventare le cose?",
    a: "La scheda raccoglie informazioni pubbliche trovate sul web e indica la fonte di ogni dato. Quello che non si trova non viene inventato: finisce tra le cose da verificare, e ogni scheda ha un livello di affidabilità (alta, media o bassa). Resta un riassunto automatico: i dettagli importanti, come nomi e numeri, conviene sempre controllarli.",
  },
  {
    q: "I miei clienti li vede qualcun altro?",
    a: "No. Ogni account vede solo i propri lead, note e trattative, anche quando lavori in squadra. E puoi esportare tutto in CSV quando vuoi.",
  },
  {
    q: "Devo installare qualcosa? Funziona dal telefono?",
    a: "Niente da installare: si usa dal browser, ed è pensato prima di tutto per il telefono. In macchina, al bar, tra una visita e l'altra.",
  },
  {
    q: "Quanto costa? Serve la carta di credito per provare?",
    a: `No, per provare non serve: crei l'account e ricevi ${SIGNUP_CREDITS} crediti gratis. Le funzioni AI usano crediti (${cr(creditCost("score"))} per un punteggio, ${cr(creditCost("chat"))} per un messaggio all'assistente, ${cr(creditCost("briefing"))} per una Scheda AI), mentre ricerca, CRM e pipeline sono sempre gratis. Quando finiscono ricarichi un pacchetto${firstPack ? `, da ${(firstPack.priceCents / 100).toLocaleString("it-IT")} € per ${firstPack.credits} crediti` : ""}: nessun abbonamento, paghi solo quello che usi.`,
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="lp-faq-title" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Kicker n="06">Domande</Kicker>
          <H2 id="lp-faq-title" className="mt-6">
            Quelle che ci fanno <span className="italic text-ink-2">al bancone.</span>
          </H2>
        </div>
        <div className="border-t border-line-strong">
          {FAQS.map((f) => (
            <details key={f.q} className="lp-faq group border-b border-line-strong">
              <summary className="flex cursor-pointer items-start justify-between gap-6 rounded-md py-6 text-left">
                <h3 className="font-display text-[24px] leading-[1.15] transition-colors group-hover:text-accent sm:text-[27px]">{f.q}</h3>
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong">
                  <Plus className="lp-faq-icon h-4 w-4" aria-hidden />
                </span>
              </summary>
              <p className="max-w-2xl pb-7 pr-12 text-[15.5px] leading-[1.7] text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
