# Architettura Agentipro

- **Stack**: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 6 + SQLite · Anthropic SDK.
- **Auth**: JWT firmato (jose) in cookie httpOnly `ap_session`. `src/middleware.ts` protegge `/app/*`.
  - Server: `requireUser()` (pagine) · `requireApiUser()` (API, restituisce `NextResponse` 401 o l'utente) da `@/lib/auth`.
  - Ogni query sui dati DEVE filtrare per `userId` (multi-utente).
- **DB**: `@/lib/db` (Prisma). Schema in `prisma/schema.prisma` (User, Lead, Activity, Conversation, Message, SavedSearch, CreditTransaction).
- **AI**: `@/lib/ai` → `anthropic()`, `MODEL_SMART` (Sonnet 5.5: assistente, Scheda AI), `MODEL_FAST` (Haiku 5.5: punteggio), `isAiDemo()` (nessuna chiave → risposte dimostrative), `sellerContext(user)`.
- **Crediti**: `@/lib/credits` → `creditCost(feature)`, `creditPacks()`, `chargeCredits` (atomico), `refundCredits`, `addCredits` (idempotente su `stripeSessionId`), `chargeForAi()` (402 pronto; in demo non scala nulla). Modelli `User.credits` (default 50) e `CreditTransaction`. Pagamenti in `@/lib/stripe` (`stripeEnabled()`, `fulfillCheckoutSession`).
- **UI**: primitivi in `@/components/ui` (Button, Input, Textarea, Select, Field, Card, Badge, ScoreBadge, StageBadge, Dialog, EmptyState, PageHeader, Spinner, useToast) e `@/components/ui/markdown`.
  Colori solo tramite token (`bg-bg`, `bg-surface`, `text-ink`, `text-ink-2`, `border-line`, `bg-accent`, …) definiti in `src/app/globals.css`, che supportano il tema scuro. Titoli pagina con `font-display`.
- **Costanti**: `@/lib/utils` → `STAGES`, `STAGE_IDS`, `stageLabel`, `ACTIVITY_TYPES`, `formatEuro`, `formatDate`, `relativeTime`, `scoreTone`, `cn`.

## Mappa delle route

| Area | Pagine | API |
|---|---|---|
| Marketing | `/` (landing) | — |
| Auth | `/login`, `/register` | `/api/auth/{login,register,logout}` |
| Oggi (dashboard) | `/app` | `/api/dashboard` |
| Ricerca lead | `/app/search` | `/api/search`, `/api/leads/import` |
| CRM | `/app/leads`, `/app/leads/[id]`, `/app/pipeline` | `/api/leads`, `/api/leads/[id]`, `/api/leads/[id]/activities`, `/api/activities/[id]`, `/api/pipeline` |
| AI | `/app/assistant` | `/api/ai/chat`, `/api/ai/briefing` (Scheda AI), `/api/ai/score`, `/api/conversations`, `/api/profile/scoring` |
| Crediti | `/app/credits` | `/api/credits/checkout`, `/api/stripe/webhook` |
| Profilo | `/app/settings` | `/api/profile` |

## AI: posizionamento e dati

L'AI è uno strumento di **ricerca e conoscenza del cliente**, non un coach di vendita: prompt, demo e UI non producono frasi d'apertura, script, obiezioni, offerte o "prossimi passi" commerciali (vedi `NO_COACHING` in `src/lib/ai/prompts.ts`).

- **Scheda AI** (`src/lib/ai/research.ts`, `ResearchSchema` in `src/lib/ai/schemas.ts`): salvata in `Lead.briefing` come JSON `{ v: 2, summary, business, people, online, reputation, facts, signals, unknowns, confidence, sources }`. Il modello restituisce stringhe vuote per i dati non trovati, convertite in `null` da `researchFromOutput`. `parseResearch` restituisce `{ kind: "legacy" }` per i briefing della versione precedente: la UI mostra "Scheda creata con la versione precedente — Aggiorna". API: `POST /api/ai/briefing` (nome storico).
- **Punteggio** (`src/lib/ai/score.ts`, `src/lib/ai/scoring.ts`): il modello restituisce sei sotto-punteggi (`fit`, `size`, `reputation`, `presence`, `proximity`, `data`) con motivazione, `confidence`, `summary`, `factors`. Il totale `Lead.score` è la media pesata calcolata in codice con `User.scoringWeights` (JSON, pesi 0-5, default in `DEFAULT_WEIGHTS`); il dettaglio sta in `Lead.scoreBreakdown`, sintesi e fattori in `Lead.scoreReason`. `PUT /api/profile/scoring` salva criteri (`User.scoringCriteria`) e pesi e ricalcola i totali con `recomputeTotals` (raggruppati per valore, nessuna chiamata AI). Se c'è una Scheda AI v2 viene passata al modello come input.
- **Errori**: il 400 di Anthropic per credito API esaurito diventa per l'utente "Il servizio AI non è momentaneamente disponibile" (`isProviderBillingError` in `src/lib/ai/client.ts`) e i crediti vengono rimborsati come per ogni errore.
