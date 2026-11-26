# Agentipro

**Il copilota per gli agenti di commercio.** Trova nuove attività nella tua zona, scopri chi chiamare per primo e arriva a ogni visita con un briefing pronto.

## Funzionalità

- **Trova clienti**: cerca per categoria ("bar", "parrucchieri", "studi dentistici"…) e luogo con un raggio in km. I dati vengono da OpenStreetMap (gratis) e, se configuri la chiave, da Google Places (telefono, rating, recensioni più completi). Salvi i risultati nel CRM con un clic.
- **Lead score AI**: un punteggio da 0 a 100 per ogni lead, con i motivi, calibrato su ciò che vendi e sul tuo cliente ideale.
- **Briefing pre-visita**: una scheda generata dall'AI, anche con ricerche web: frase d'apertura, punti da toccare, obiezioni probabili con le risposte, offerta da proporre e domande da fare.
- **Assistente AI**: una chat che conosce il tuo CRM. Ti dice chi richiamare, scrive email e messaggi, prepara il piano visite e risponde alle obiezioni.
- **CRM e pipeline**: le fasi Nuovo → Contattato → Qualificato → Trattativa → Vinto/Perso, con drag & drop, note, attività, promemoria, valore della pipeline ed export CSV.
- **Oggi**: una dashboard con i follow-up in scadenza, i lead più caldi e i numeri che contano.
- Multi-utente con login, responsive, tema chiaro/scuro.

## Avvio rapido

Requisiti: Node.js 20+.

```bash
npm install
cp .env.example .env        # poi modifica i valori
npx prisma db push          # crea il database SQLite
npm run db:seed             # opzionale: utente demo con dati di esempio
npm run dev
```

Apri http://localhost:3000. Con il seed puoi accedere come `demo@agentipro.it` / `demo1234`.

## Configurazione (`.env`)

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `DATABASE_URL` | sì | Percorso del database SQLite (`file:./dev.db`). |
| `AUTH_SECRET` | sì in produzione | Segreto per firmare la sessione (`openssl rand -base64 32`). |
| `ANTHROPIC_API_KEY` | no | Chiave per Claude. Senza chiave le funzioni AI girano in **modalità demo** con risposte di esempio. |
| `AI_MODEL_SMART` | no | Modello per chat e briefing (default `claude-opus-5-5`). |
| `AI_MODEL_FAST` | no | Modello per il lead score massivo (default `claude-haiku-5-5`). |
| `GOOGLE_PLACES_API_KEY` | no | Abilita Google Places (API New). Senza chiave si usa OpenStreetMap. |
| `LEADS_DEMO_MODE` | no | `true` forza risultati di ricerca dimostrativi (utile offline). |

## Script

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo |
| `npm run build` / `npm start` | Build e avvio in produzione |
| `npm run lint` | ESLint |
| `npm test` | Test unitari (Vitest) |
| `npm run test:e2e` | Test end-to-end (Playwright) |
| `npm run db:seed` | Ricrea l'utente demo |

## Architettura

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma + SQLite · Anthropic SDK. I dettagli sono in [`docs/architecture.md`](docs/architecture.md).

Per la produzione su più istanze conviene passare a PostgreSQL: basta cambiare `provider` in `prisma/schema.prisma` e `DATABASE_URL`.
