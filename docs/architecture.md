# Architettura Agentipro

- **Stack**: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 6 + SQLite · Anthropic SDK.
- **Auth**: JWT firmato (jose) in cookie httpOnly `ap_session`. `src/middleware.ts` protegge `/app/*`.
  - Server: `requireUser()` (pagine) · `requireApiUser()` (API, restituisce `NextResponse` 401 o l'utente) da `@/lib/auth`.
  - Ogni query sui dati DEVE filtrare per `userId` (multi-utente).
- **DB**: `@/lib/db` (Prisma). Schema in `prisma/schema.prisma` (User, Lead, Activity, Conversation, Message, SavedSearch, CreditTransaction).
- **AI**: `@/lib/ai` → `anthropic()`, `MODEL_SMART` (Sonnet 5.5: chat, briefing), `MODEL_FAST` (Haiku 5.5: lead score), `isAiDemo()` (nessuna chiave → risposte dimostrative), `sellerContext(user)`.
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
| AI | `/app/assistant` | `/api/ai/chat`, `/api/ai/briefing`, `/api/ai/score`, `/api/conversations` |
| Crediti | `/app/credits` | `/api/credits/checkout`, `/api/stripe/webhook` |
| Profilo | `/app/settings` | `/api/profile` |
