import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal";

export const metadata: Metadata = {
  title: "Termini d'uso",
  description: "Le regole di base per usare Agentipro.",
};

export default function TerminiPage() {
  return (
    <LegalPage
      kicker="Termini d'uso"
      title="Le regole del gioco."
      updated="novembre 2026"
      sections={[
        {
          h: "Il servizio",
          p: [
            "Agentipro è uno strumento di lavoro per agenti di commercio: ricerca di attività, CRM, pipeline e funzioni di intelligenza artificiale a supporto della vendita.",
          ],
        },
        {
          h: "Il tuo account",
          p: [
            "Sei responsabile delle credenziali e di quello che fai con il tuo account. Usa il servizio nel rispetto della legge, compresa la normativa sul contatto commerciale e sulla protezione dei dati delle persone che contatti.",
          ],
        },
        {
          h: "Contenuti generati dall'AI",
          p: [
            "Punteggi, Schede AI e risposte dell'assistente sono generati automaticamente a partire da dati pubblici e da quelli che inserisci. Possono contenere imprecisioni: verifica sempre le informazioni importanti prima di usarle con un cliente.",
          ],
        },
        {
          h: "Dati di terze parti",
          p: [
            "Le informazioni sulle attività provengono da fonti pubbliche (OpenStreetMap, Google Places se attivato) e possono essere incomplete o non aggiornate. I dati OpenStreetMap sono © dei contributori OpenStreetMap, con licenza ODbL.",
          ],
        },
        {
          h: "Piani e prezzi",
          p: [
            "I prezzi mostrati sul sito sono indicativi. Le condizioni definitive di ogni piano a pagamento vengono comunicate prima dell'attivazione, e puoi disdire quando vuoi.",
          ],
        },
      ]}
    />
  );
}
