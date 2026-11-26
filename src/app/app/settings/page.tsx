import { requireUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import Link from "next/link";
import { Coins } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { stripeEnabled } from "@/lib/stripe";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profilo" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const google = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Il tuo profilo" description="Queste informazioni guidano l'AI: punteggi, briefing e risposte saranno calibrati su ciò che vendi." />
      {welcome && (
        <Card className="mb-6 border-accent/40 bg-accent-soft p-5">
          <p className="font-semibold">Benvenuto in Agentipro, {user.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-ink-2">Compila il profilo commerciale qui sotto: bastano due minuti e l&apos;AI sarà subito più precisa.</p>
        </Card>
      )}
      <ProfileForm profile={user} />
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Coins className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="font-semibold">Crediti AI</h2>
            <p className="text-sm text-ink-2">Saldo: <span className="font-mono font-semibold text-ink tabular-nums">{user.credits}</span> crediti</p>
          </div>
        </div>
        <Link href="/app/credits" className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2">
          Gestisci crediti
        </Link>
      </Card>
      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-semibold">Integrazioni</h2>
        <ul className="mt-4 divide-y divide-line text-sm">
          <li className="flex items-center justify-between py-3">
            <span>Intelligenza artificiale (Claude)</span>
            {isAiDemo() ? <Badge tone="warn">Demo</Badge> : <Badge tone="success">Attiva</Badge>}
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Ricerca su OpenStreetMap</span><Badge tone="success">Attiva</Badge>
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Google Places (dati arricchiti)</span>
            {google ? <Badge tone="success">Attiva</Badge> : <Badge>Non configurata</Badge>}
          </li>
          <li className="flex items-center justify-between py-3">
            <span>Pagamenti (Stripe)</span>
            {stripeEnabled() ? <Badge tone="success">Attiva</Badge> : <Badge>Non configurata</Badge>}
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">Le chiavi si configurano nelle variabili d&apos;ambiente del server (vedi README).</p>
      </Card>
    </div>
  );
}
