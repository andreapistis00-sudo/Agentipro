import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Come Agentipro tratta i tuoi dati e quelli dei tuoi clienti, in breve e senza giri di parole.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Informativa sintetica"
      title="Privacy, in parole semplici."
      updated="novembre 2026"
      sections={[
        {
          h: "Quali dati trattiamo",
          p: [
            "I dati del tuo account (nome, email, password cifrata) e quello che inserisci nell'app: profilo commerciale, lead, note, attività, promemoria e conversazioni con l'assistente.",
            "Le attività che trovi con la ricerca provengono da fonti pubbliche come OpenStreetMap e, se attivato, Google Places.",
          ],
        },
        {
          h: "Perché li trattiamo",
          p: [
            "Solo per farti usare il servizio: mostrarti il tuo CRM, calcolare i punteggi, preparare briefing e risposte dell'assistente. Non vendiamo i tuoi dati e non li usiamo per pubblicità.",
          ],
        },
        {
          h: "Intelligenza artificiale",
          p: [
            "Per le funzioni AI (lead score, briefing, assistente) i dati necessari vengono inviati a un fornitore di modelli linguistici che li elabora per conto nostro, al solo scopo di generare la risposta richiesta.",
          ],
        },
        {
          h: "Chi li vede",
          p: [
            "Ogni account vede solo i propri dati. Anche nei piani per i team, i lead di un agente non sono visibili agli altri utenti.",
          ],
        },
        {
          h: "I tuoi diritti",
          p: [
            "Puoi consultare, correggere ed esportare i tuoi dati in qualsiasi momento dall'app, e chiedere la cancellazione dell'account. Per ogni richiesta relativa alla privacy puoi contattare il titolare del servizio.",
          ],
        },
      ]}
    />
  );
}
