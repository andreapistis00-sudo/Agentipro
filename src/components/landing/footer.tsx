import Link from "next/link";
import { Logo } from "@/components/app/logo";

const COLS = [
  { title: "Prodotto", links: [["/#funzioni", "Funzioni"], ["/#come-funziona", "Come funziona"], ["/#prezzi", "Prezzi"], ["/#faq", "Domande"]] },
  { title: "Account", links: [["/register", "Crea un account"], ["/login", "Accedi"], ["/app", "Vai all'app"]] },
  { title: "Legale", links: [["/privacy", "Privacy"], ["/termini", "Termini d'uso"]] },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-[var(--lp-gutter)] py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 font-display text-[22px] italic leading-snug text-ink-2">
            Trova le attività della tua zona e conoscile con l&apos;AI.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-[14px] text-ink-2 transition-colors hover:text-ink">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-line px-[var(--lp-gutter)] py-6 font-mono text-[11px] text-ink-3">
        <span>© {new Date().getFullYear()} Agentipro</span>
        <span>Pensato in Italia, tra un caffè e l&apos;altro.</span>
      </div>
    </footer>
  );
}
