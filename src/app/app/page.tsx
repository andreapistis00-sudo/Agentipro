import Link from "next/link";
import { ArrowRight, CalendarCheck2, Flame, Search, UserRoundPen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button, Card, ScoreBadge } from "@/components/ui";
import { formatEuro } from "@/lib/utils";
import { getDashboard } from "@/lib/crm/dashboard";
import { fmtDate, fmtDateTime, TZ } from "@/lib/crm/format";
import { ActivityIcon } from "@/components/crm/bits";
import { NewLeadButton } from "@/components/crm/new-lead-dialog";
import { TodoList } from "./_dashboard/todo-list";

export const metadata = { title: "Oggi" };

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const data = await getDashboard(user.id, now);
  const firstName = user.name.split(" ")[0];
  const profileEmpty = !user.sector && !user.products && !user.idealCustomer;
  const dateLabel = fmtDate(now, { weekday: "long", day: "numeric", month: "long" });
  const { kpi } = data;

  const header = (
    <div className="mb-8">
      <p className="text-[13px] font-medium text-ink-3">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p>
      <h1 className="mt-1 font-display text-[38px] leading-none tracking-tight sm:text-[44px]">{greeting(now)}, {firstName}</h1>
      {kpi.totalLeads > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          {data.todos.length === 0
            ? "Nessuna scadenza per oggi: è un buon momento per cercare nuovi clienti."
            : <>Hai <span className="font-medium text-ink">{data.todos.length} {data.todos.length === 1 ? "cosa" : "cose"} da fare</span>{kpi.overdue > 0 && <>, di cui <span className="font-medium text-danger">{kpi.overdue} in ritardo</span></>}.</>}
        </p>
      )}
    </div>
  );

  if (kpi.totalLeads === 0) {
    return (
      <div className="max-w-4xl">
        {header}
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[1.3fr_1fr]">
            <div className="p-6 sm:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">Primo passo</span>
              <h2 className="mt-4 font-display text-[30px] leading-tight tracking-tight">Trova i tuoi primi clienti</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
                Cerca bar, ristoranti, negozi o qualsiasi attività nella tua zona. Agentipro li raccoglie, li valuta con l&apos;AI e ti dice chi chiamare per primo.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/app/search"><Button variant="secondary" size="lg"><Search className="h-4 w-4" />Trova i tuoi primi clienti</Button></Link>
                <NewLeadButton variant="outline" label="Aggiungi a mano" />
              </div>
            </div>
            <ol className="space-y-4 border-t border-line bg-bg/60 p-6 text-sm sm:p-8 md:border-l md:border-t-0">
              {["Cerca le attività nella tua zona", "Importa quelle interessanti nel CRM", "Segui ogni trattativa fino alla firma"].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-[12px] text-ink-2">{i + 1}</span>
                  <span className="pt-0.5 text-ink-2">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
        {profileEmpty && <ProfileCta />}
      </div>
    );
  }

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <div>
      {header}
      {profileEmpty && <div className="mb-6"><ProfileCta /></div>}

      {/* KPI */}
      <section aria-label="Indicatori" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Clienti totali" value={kpi.totalLeads.toLocaleString("it-IT")} hint={`${kpi.openCount} aperti`} href="/app/leads" />
        <Kpi label="In trattativa" value={String(kpi.negotiation)} hint={`${kpi.qualified} qualificati`} href="/app/leads?stage=negotiation" />
        <Kpi label="Pipeline aperta" value={formatEuro(kpi.openPipelineValue)} hint={`${formatEuro(kpi.wonValue)} già vinti`} href="/app/pipeline" />
        <Kpi label="Conversione" value={kpi.conversionRate == null ? "—" : `${Math.round(kpi.conversionRate * 100)}%`} hint={`${kpi.won} vinti · ${kpi.lost} persi`} />
        <Kpi label="Fatte questa settimana" value={String(kpi.doneThisWeek)} hint="attività completate" className="col-span-2 md:col-span-1" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={<CalendarCheck2 className="h-4 w-4" />} title="Da fare oggi" right={data.todos.length ? <span className="text-[12.5px] tabular-nums text-ink-3">{data.todos.length}</span> : null} />
          {data.todos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
              <p className="text-sm font-medium">Tutto in ordine</p>
              <p className="mt-1 text-[13px] text-ink-3">Nessun promemoria o follow-up in scadenza. Programmane uno dalla scheda di un cliente.</p>
            </div>
          ) : <TodoList todos={data.todos} />}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle icon={<Flame className="h-4 w-4 text-hot" />} title="Lead più caldi" right={<Link href="/app/leads?stage=new&sort=score" className="text-[12.5px] font-medium text-ink-2 hover:text-ink">Vedi tutti</Link>} />
          {data.hotLeads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-ink-3">
              Nessun nuovo cliente valutato. Usa “Valuta con AI” nella lista clienti per scoprire chi chiamare per primo.
            </p>
          ) : (
            <ul className="-mx-2">
              {data.hotLeads.map((l) => (
                <li key={l.id}>
                  <Link href={`/app/leads/${l.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2/70">
                    <ScoreBadge score={l.score} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.name}</div>
                      <div className="truncate text-[12.5px] text-ink-3">{[l.category, l.city].filter(Boolean).join(" · ")}</div>
                    </div>
                    {l.value != null && <span className="hidden text-[12.5px] tabular-nums text-ink-2 sm:block">{formatEuro(l.value)}</span>}
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle title="Clienti per fase" right={<Link href="/app/pipeline" className="text-[12.5px] font-medium text-ink-2 hover:text-ink">Apri pipeline</Link>} />
          <ul className="space-y-2.5">
            {data.funnel.map((f) => (
              <li key={f.id}>
                <Link href={`/app/leads?stage=${f.id}`} className="group grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-3 text-[13px]"
                  title={`${f.label}: ${f.count} clienti · ${formatEuro(f.value)}`}>
                  <span className="truncate text-ink-2 group-hover:text-ink">{f.label}</span>
                  <span className="h-2.5 rounded-full bg-surface-2">
                    <span className="block h-full rounded-full transition-[width]" style={{ width: `${f.count ? Math.max(4, (f.count / maxFunnel) * 100) : 0}%`, background: `var(--stage-${f.id})` }} />
                  </span>
                  <span className="w-[92px] text-right tabular-nums">
                    <span className="font-medium text-ink">{f.count}</span>
                    <span className="ml-1.5 text-ink-3">{formatEuro(f.value)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle title="Attività recenti" />
          {data.recent.length === 0 ? (
            <p className="text-[13px] text-ink-3">Le chiamate, le visite e le note che registri compariranno qui.</p>
          ) : (
            <ul className="space-y-3">
              {data.recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] leading-snug">{a.content}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-3">
                      <Link href={`/app/leads/${a.lead.id}`} className="text-ink-2 hover:underline">{a.lead.name}</Link> · {fmtDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, href, className }: { label: string; value: string; hint?: string; href?: string; className?: string }) {
  const body = (
    <>
      <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
      <div className="mt-2 font-display text-[32px] leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-2 truncate text-[12px] text-ink-3">{hint}</div>}
    </>
  );
  const cls = `block rounded-[var(--radius)] border border-line bg-surface p-4 shadow-card ${className ?? ""}`;
  return href ? <Link href={href} className={`${cls} transition hover:border-line-strong`}>{body}</Link> : <div className={cls}>{body}</div>;
}

function SectionTitle({ title, icon, right }: { title: string; icon?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold">{icon}{title}</h2>
      {right}
    </div>
  );
}

function ProfileCta() {
  return (
    <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><UserRoundPen className="h-5 w-5" /></span>
      <div className="flex-1">
        <p className="font-semibold">Completa il profilo</p>
        <p className="text-[13px] text-ink-2">Racconta cosa vendi e chi è il tuo cliente ideale: punteggi e briefing dell&apos;AI saranno molto più precisi.</p>
      </div>
      <Link href="/app/settings"><Button variant="outline">Completa il profilo</Button></Link>
    </Card>
  );
}
