# Agentipro

**Il CRM con l'AI per agenti di commercio.** Trova le attività della tua zona, conoscile con le informazioni pubbliche raccolte dall'AI, valutale con un punteggio basato sui tuoi criteri e organizzale in pipeline.

## Funzionalità

- **Trova clienti**: cerca per categoria ("bar", "parrucchieri", "studi dentistici"…) e luogo con un raggio in km. I dati vengono da OpenStreetMap (gratis) e, se configuri la chiave, da Google Places (telefono, rating, recensioni più completi). Salvi i risultati nel CRM con un clic.
- **Punteggio AI**: ogni cliente riceve sei sotto-punteggi 0-100 (aderenza, dimensione, reputazione, presenza online, vicinanza, completezza dati), ciascuno con la motivazione, più affidabilità e fattori +/−. Il totale è la **media pesata calcolata dall'app** con i pesi scelti nel Profilo (0-5 per dimensione): cambiando i pesi i totali si ricalcolano subito, senza chiamare l'AI. Nel Profilo si scrivono anche i propri criteri ("Come valuti un cliente"), che il modello usa nelle valutazioni successive.
- **Scheda AI**: ricerca di informazioni pubbliche sul cliente (ricerca web + sintesi strutturata): chi è, cosa offre, orari, sedi, persone citate, presenza online, recensioni (positivi/negativi), fatti, segnali, cose da verificare e fonti, con un livello di affidabilità. Solo fatti, nessun consiglio commerciale. Se trova recapiti che mancano, propone di salvarli nella scheda cliente.
- **Assistente di ricerca**: una chat che conosce il tuo CRM e cerca sul web: cosa sai di un cliente, chi non senti da un certo tempo, confronti tra clienti, riassunti delle note; registra note e promemoria su richiesta.
- **CRM e pipeline**: le fasi Nuovo → Contattato → Qualificato → Trattativa → Vinto/Perso, con drag & drop, note, attività, promemoria, valore della pipeline ed export CSV.
- **Oggi**: una dashboard con i follow-up in scadenza, i clienti con il punteggio più alto e i numeri che contano.
- **Crediti AI**: le funzioni AI consumano crediti; ogni nuovo utente ne riceve 50 gratis e ricarica con **Stripe Checkout** (vedi [Crediti e pagamenti](#crediti-e-pagamenti)).
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
| `APP_URL` | in produzione | URL pubblico, usato per le anteprime social (default `http://localhost:3000`). |
| `AUTH_SECRET` | sì in produzione | Segreto per firmare la sessione (`openssl rand -base64 32`). |
| `ANTHROPIC_API_KEY` | no | Chiave per Claude. Senza chiave le funzioni AI girano in **modalità demo** con risposte di esempio. |
| `AI_MODEL_SMART` | no | Modello per assistente e Scheda AI (default `claude-sonnet-5-5`). |
| `AI_MODEL_FAST` | no | Modello per il punteggio AI (default `claude-haiku-5-5`). |
| `GOOGLE_PLACES_API_KEY` | no | Abilita Google Places (API New). Senza chiave si usa OpenStreetMap. |
| `SEARCH_COUNTRYCODES` | no | Paesi in cui cercare i luoghi (default `it`; vuoto = tutto il mondo). |
| `LEADS_DEMO_MODE` | no | `true` forza risultati di ricerca dimostrativi (utile offline). |
| `STRIPE_SECRET_KEY` | per i pagamenti | Chiave segreta Stripe (`sk_live_…` / `sk_test_…`). Senza chiave la pagina Crediti mostra i pacchetti con i bottoni disabilitati. |
| `STRIPE_WEBHOOK_SECRET` | consigliata | Segreto di firma del webhook (`whsec_…`), vedi sotto. |
| `CREDIT_COST_SCORE` | no | Crediti per ogni lead valutato (default `1`). |
| `CREDIT_COST_CHAT` | no | Crediti per ogni messaggio all'assistente (default `2`). |
| `CREDIT_COST_BRIEFING` | no | Crediti per ogni Scheda AI (ricerca sul cliente, default `5`). |
| `CREDIT_PACKS` | no | Pacchetti di ricarica `prezzoInCentesimi:crediti` separati da virgola (default `500:100,2000:500,5000:1500`). |

## Crediti e pagamenti

- Ogni nuovo utente parte con **50 crediti gratis** (anche gli utenti già esistenti, grazie al default dello schema).
- Costi predefiniti: **1 credito** per lead valutato, **2** per messaggio all'assistente, **5** per Scheda AI (configurabili con `CREDIT_COST_*`). Ricerca, CRM, pipeline ed export sono gratuiti.
- I crediti si scalano **solo con l'AI reale** (`ANTHROPIC_API_KEY` impostata): in modalità demo non si consuma nulla. L'addebito avviene prima della chiamata ed è atomico; se l'operazione fallisce per un errore i crediti vengono rimborsati (anche quando il servizio AI non è disponibile, ad esempio per credito esaurito sull'account Anthropic: all'utente compare solo "Il servizio AI non è momentaneamente disponibile") (score: solo per i lead non valutati; chat: non se l'utente interrompe la risposta). Senza saldo sufficiente le API rispondono `402` con `{ error: "Crediti esauriti", code: "INSUFFICIENT_CREDITS", needed, balance }`.
- Pacchetti predefiniti: **5 € → 100 crediti**, **20 € → 500 crediti**, **50 € → 1.500 crediti** (`CREDIT_PACKS`). Pagina `/app/credits`: saldo, costi, pacchetti e storico movimenti.

### Configurare Stripe

1. Imposta `STRIPE_SECRET_KEY` (in prova usa la chiave `sk_test_…` e la carta `4242 4242 4242 4242`).
2. Nella Dashboard Stripe → **Developers → Webhooks → Add endpoint**: URL `https://<dominio>/api/stripe/webhook`, evento **`checkout.session.completed`** (facoltativo anche `checkout.session.async_payment_succeeded`). Copia il **Signing secret** in `STRIPE_WEBHOOK_SECRET`.
3. In locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook` e usa il `whsec_…` che stampa.

L'accredito è idempotente sull'id della Checkout Session. Se il webhook non è configurato (o è in ritardo) i crediti vengono accreditati comunque quando l'utente torna su `/app/credits?session_id=…`: la pagina verifica la sessione su Stripe (pagata e intestata all'utente corrente) prima di accreditare.

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

## Test

- `npm test`: 94 test unitari (ricerca, AI con client Anthropic simulato, tool del CRM, crediti su un database SQLite temporaneo).
- `npm run test:e2e`: 34 scenari Playwright su desktop e mobile (registrazione, ricerca, import, scheda cliente, pipeline, assistente, crediti, isolamento tra utenti, export). Avviano da soli un server di produzione con un database dedicato, in modalità demo.

## Pubblicare su Railway

1. Su [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** → scegli questa repo (branch con il codice).
2. Nel servizio: **Settings → Volumes → Add Volume** con mount path `/data` (qui vive il database SQLite).
3. **Variables**: `DATABASE_URL=file:/data/agentipro.db`, `AUTH_SECRET=<stringa casuale lunga>`, `APP_URL=https://<il-tuo-dominio>.up.railway.app`, per l'AI reale `ANTHROPIC_API_KEY` e, per le ricariche, `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (webhook su `https://<il-tuo-dominio>.up.railway.app/api/stripe/webhook`).
4. **Settings → Networking → Generate Domain**. Build e avvio usano `railway.json`: il database si crea da solo al primo avvio.
5. Apri il dominio e crea il tuo account da `/register`.

## Note per la produzione

- Imposta `AUTH_SECRET`, `APP_URL` e, per l'AI reale, `ANTHROPIC_API_KEY`; per i pagamenti `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`. `APP_URL` serve anche per gli URL di ritorno da Stripe Checkout.
- I limiti di frequenza (login, ricerca, AI) sono in memoria: valgono per una singola istanza. Per IP leggono `X-Forwarded-For`, quindi metti l'app dietro un proxy che imposti quell'header (Vercel, Nginx, Cloudflare…).
- Per la produzione su più istanze conviene passare a PostgreSQL: basta cambiare `provider` in `prisma/schema.prisma` e `DATABASE_URL`.
