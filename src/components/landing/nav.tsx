import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { CtaLink } from "./shared";

const LINKS = [
  { href: "/#giornata", label: "Una giornata" },
  { href: "/#funzioni", label: "Funzioni" },
  { href: "/#prezzi", label: "Prezzi" },
  { href: "/#faq", label: "Domande" },
];

export function LandingNav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg/80">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-6 px-[var(--lp-gutter)]">
        <Link href="/" aria-label="Agentipro, torna all'inizio" className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Sezioni" className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-full px-3 py-1.5 text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {loggedIn ? (
            <CtaLink href="/app" variant="ink">Vai all&apos;app</CtaLink>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:text-ink">
                Accedi
              </Link>
              <CtaLink href="/register" arrow={false} className="px-4">Prova gratis</CtaLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
