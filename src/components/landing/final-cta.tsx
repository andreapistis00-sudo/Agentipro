import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "./shared";
import { Reveal } from "./reveal";

const ROWS = [
  ["08:30", "Bar Centrale", "82"],
  ["09:40", "Studio Ferri", "91"],
  ["11:15", "Pasticceria Rinaldi", "88"],
  ["14:30", "Salone Elsa", "74"],
  ["16:00", "Ferramenta Bonetti", "63"],
];

/** Lo "scontrino" del giro di domani: il dettaglio tattile della chiusura. */
function Receipt() {
  return (
    <div className="lp-receipt w-[300px] rotate-[3deg] px-6 pb-9 pt-6 font-mono text-[12px] leading-[1.7] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.35)]" aria-hidden>
      <p className="text-center text-[13px] font-semibold tracking-[0.2em]">AGENTIPRO</p>
      <p className="text-center text-[11px] opacity-60">giro di mercoledì · 5 visite</p>
      <p className="my-3 border-t border-dashed border-current opacity-40" />
      {ROWS.map(([t, n, s]) => (
        <p key={n} className="flex gap-2">
          <span className="opacity-60">{t}</span>
          <span className="min-w-0 flex-1 truncate">{n}</span>
          <span className={Number(s) >= 80 ? "font-semibold text-[#d63c0c]" : ""}>{s}</span>
        </p>
      ))}
      <p className="my-3 border-t border-dashed border-current opacity-40" />
      <p className="flex justify-between"><span>SCHEDE AI</span><span>5/5</span></p>
      <p className="flex justify-between"><span>RICHIAMI</span><span>3</span></p>
      <p className="flex justify-between font-semibold"><span>PIPELINE APERTA</span><span>14.200 €</span></p>
      <p className="my-3 border-t border-dashed border-current opacity-40" />
      <p className="text-center text-[11px] tracking-[0.12em] opacity-70">GRAZIE E BUONE VENDITE</p>
    </div>
  );
}

export function FinalCta({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section aria-labelledby="lp-cta-title" className="lp-on-accent relative overflow-hidden bg-accent">
      <Container className="relative grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-70">Ultima fermata</p>
          <h2 id="lp-cta-title" className="mt-6 max-w-[14ch] font-display text-[clamp(3rem,7vw,6.6rem)] leading-[0.9] tracking-[-0.025em]">
            Inizia dalla <span className="italic">tua zona.</span>
          </h2>
          <p className="mt-7 max-w-lg text-[17px] leading-relaxed opacity-80">
            Crei l&apos;account in un minuto, descrivi cosa vendi e fai la prima ricerca. I primi crediti AI sono gratis, senza carta.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href={loggedIn ? "/app" : "/register"}
              className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-[var(--lp-ink)] px-7 text-[16px] font-medium text-[var(--lp-paper)] transition-transform active:scale-[0.98]"
            >
              {loggedIn ? "Vai all'app" : "Prova gratis"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            {!loggedIn && (
              <Link href="/login" className="text-[15px] font-medium underline decoration-2 underline-offset-4 opacity-85 hover:opacity-100">
                Ho già un account
              </Link>
            )}
          </div>
        </div>
        <Reveal y={40} className="hidden justify-center md:flex lg:pr-6">
          <Receipt />
        </Reveal>
      </Container>
    </section>
  );
}
