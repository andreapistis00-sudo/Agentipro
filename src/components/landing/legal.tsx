/** Impaginazione sobria per le pagine legali. */
export function LegalPage({ kicker, title, updated, sections }: {
  kicker: string;
  title: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}) {
  return (
    <article>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{kicker}</p>
      <h1 className="mt-5 font-display text-[clamp(3rem,7vw,5rem)] leading-[0.95] tracking-[-0.02em]">{title}</h1>
      <p className="mt-4 font-mono text-[12px] text-ink-3">Ultimo aggiornamento: {updated}</p>
      <div className="mt-14 space-y-12">
        {sections.map((s, i) => (
          <section key={s.h} className="grid gap-3 border-t border-line pt-8 sm:grid-cols-[48px_1fr]">
            <span className="font-mono text-[12px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="font-display text-[28px] leading-tight">{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="mt-3 text-[15.5px] leading-[1.75] text-ink-2">{t}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
