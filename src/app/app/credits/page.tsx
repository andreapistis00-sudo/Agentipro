import { redirect } from "next/navigation";
import { CheckCircle2, Coins, Info, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { LOW_CREDITS, creditCost, creditPacks, reasonLabel } from "@/lib/credits";
import { fulfillCheckoutSession, stripe, stripeEnabled } from "@/lib/stripe";
import { BuyButton } from "./buy-button";

export const metadata = { title: "Crediti" };
export const dynamic = "force-dynamic";

type Search = { session_id?: string; canceled?: string; topup?: string; credits?: string };

const eur = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const num = (n: number) => new Intl.NumberFormat("it-IT").format(n);

/**
 * Ritorno da Stripe Checkout: verifica la sessione e accredita in modo idempotente (rete di sicurezza se il webhook
 * non è configurato o è in ritardo), poi reindirizza così layout e saldo si rileggono aggiornati.
 */
async function handleReturn(sessionId: string, userId: string): Promise<never> {
  let target = "/app/credits?topup=error";
  if (stripeEnabled() && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      const res = await fulfillCheckoutSession(session, userId);
      if (res.status === "credited" || res.status === "already") target = `/app/credits?topup=ok&credits=${res.credits}`;
      else if (res.status === "unpaid") target = "/app/credits?topup=pending";
    } catch (err) {
      console.error("[credits] verifica sessione Stripe non riuscita", sessionId, err);
    }
  }
  redirect(target);
}

export default async function CreditsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  if (sp.session_id) await handleReturn(sp.session_id, user.id);

  const [fresh, history] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { credits: true } }),
    db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const balance = fresh?.credits ?? user.credits;
  const demo = isAiDemo();
  const payments = stripeEnabled();
  const packs = creditPacks();
  const costs = [
    { label: "Punteggio AI", unit: "per cliente valutato", cost: creditCost("score") },
    { label: "Messaggio all'assistente", unit: "per messaggio", cost: creditCost("chat") },
    { label: "Scheda AI (ricerca sul cliente)", unit: "per scheda", cost: creditCost("briefing") },
  ];
  const added = Number(sp.credits);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Crediti" description="Le funzioni AI consumano crediti. Ricarichi quando vuoi, senza abbonamento." />

      {sp.topup === "ok" && (
        <Notice tone="success" icon={CheckCircle2}>
          Ricarica completata{Number.isInteger(added) && added > 0 ? <>: <strong>+{num(added)} crediti</strong></> : ""}. Grazie!
        </Notice>
      )}
      {sp.topup === "pending" && (
        <Notice tone="info" icon={Info}>Pagamento in elaborazione: i crediti arriveranno appena Stripe lo conferma. Ricarica la pagina tra qualche istante.</Notice>
      )}
      {sp.topup === "error" && (
        <Notice tone="danger" icon={XCircle}>Non siamo riusciti a verificare il pagamento. Se l&apos;addebito è avvenuto, i crediti arriveranno a breve; altrimenti contattaci.</Notice>
      )}
      {sp.canceled && <Notice tone="info" icon={Info}>Pagamento annullato: nessun addebito. Puoi riprovare quando vuoi.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card className="flex flex-col justify-between p-6">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Saldo disponibile</p>
            <p className="mt-3 flex items-baseline gap-3">
              <span className={cn("font-display text-[72px] leading-none tracking-tight tabular-nums", balance < LOW_CREDITS && "text-warn")} data-testid="credits-page-balance">
                {num(balance)}
              </span>
              <span className="text-sm text-ink-2">crediti</span>
            </p>
            {balance < LOW_CREDITS && <p className="mt-3 text-sm text-warn">{balance === 0 ? "Hai esaurito i crediti." : "Stai per esaurire i crediti."} Scegli un pacchetto qui sotto.</p>}
          </div>
          {demo && (
            <p className="mt-6 rounded-xl border border-dashed border-line-strong p-3 text-[13px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Modalità demo AI:</span> le risposte sono dimostrative e i crediti non vengono scalati.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Quanto costa ogni azione</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {costs.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 py-3">
                <span>{c.label} <span className="text-ink-3">· {c.unit}</span></span>
                <span className="shrink-0 font-mono font-semibold tabular-nums">{c.cost === 1 ? "1 credito" : `${c.cost} crediti`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Ricerca clienti, CRM, pipeline ed export sono sempre gratuiti. Se un&apos;operazione AI non riesce, i crediti tornano indietro.</p>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="packs-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="packs-title" className="font-display text-[26px] leading-none tracking-tight">Ricarica</h2>
          <p className="text-xs text-ink-3">Pagamento una tantum e sicuro con Stripe · nessun abbonamento</p>
        </div>
        {!payments && (
          <Notice tone="warn" icon={Info}>Pagamenti non ancora attivi: le ricariche saranno disponibili a breve.</Notice>
        )}
        <ul className="grid gap-4 md:grid-cols-3">
          {packs.map((p) => (
            <li
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-[var(--radius)] border p-6",
                p.featured ? "border-ink bg-ink text-bg shadow-pop" : "border-line bg-surface shadow-card",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent-ink">Più scelto</span>
              )}
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none tabular-nums">{num(p.credits)}</span>
                <span className={cn("text-sm", p.featured ? "text-bg/70" : "text-ink-2")}>crediti</span>
              </p>
              <p className="mt-4 text-[26px] font-semibold tabular-nums">{eur(p.priceCents)}</p>
              <p className={cn("mt-1 text-xs", p.featured ? "text-bg/60" : "text-ink-3")}>
                {(p.priceCents / p.credits).toLocaleString("it-IT", { maximumFractionDigits: 1 })} cent a credito
              </p>
              <p className={cn("mt-4 flex-1 text-[13px] leading-relaxed", p.featured ? "text-bg/75" : "text-ink-2")}>
                Fino a {num(Math.floor(p.credits / Math.max(1, creditCost("score"))))} clienti valutati, {num(Math.floor(p.credits / Math.max(1, creditCost("chat"))))} messaggi o {num(Math.floor(p.credits / Math.max(1, creditCost("briefing"))))} Schede AI.
              </p>
              <BuyButton packId={p.id} label={`Acquista ${num(p.credits)} crediti`} disabled={!payments} featured={p.featured} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-4 font-display text-[26px] leading-none tracking-tight">Movimenti</h2>
        <Card className="overflow-hidden">
          {history.length === 0 ? (
            <p className="p-6 text-sm text-ink-2">Nessun movimento ancora.</p>
          ) : (
            <ul className="divide-y divide-line" aria-label="Storico movimenti">
              {history.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", t.amount >= 0 ? "bg-success-soft text-success" : "bg-surface-2 text-ink-2")}>
                    <Coins className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{reasonLabel(t.reason)}</p>
                    <p className="text-xs text-ink-3">
                      <time dateTime={t.createdAt.toISOString()}>
                        {formatDate(t.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                      </time>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-mono font-semibold tabular-nums", t.amount >= 0 ? "text-success" : "text-ink")}>
                      {t.amount >= 0 ? "+" : "−"}{num(Math.abs(t.amount))}
                    </p>
                    <p className="text-xs text-ink-3 tabular-nums">saldo {num(t.balanceAfter)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {demo && <p className="mt-2 text-xs text-ink-3"><Badge tone="warn">Demo</Badge> In modalità demo le funzioni AI non generano movimenti.</p>}
      </section>
    </div>
  );
}

function Notice({ tone, icon: Icon, children }: { tone: "success" | "info" | "danger" | "warn"; icon: typeof Info; children: React.ReactNode }) {
  const cls = {
    success: "border-success/30 bg-success-soft text-success",
    info: "border-line bg-surface-2 text-ink-2",
    danger: "border-danger/30 bg-danger-soft text-danger",
    warn: "border-warn/30 bg-warn-soft text-warn",
  }[tone];
  return (
    <div className={cn("mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", cls)} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
