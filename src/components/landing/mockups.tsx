// Mockup dell'interfaccia costruiti in HTML/CSS (niente screenshot): leggeri, nitidi, a tema.
import { ArrowUp, Clock, Download, Globe, GripVertical, MapPin, Phone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SaveToggle } from "./save-toggle";

function Frame({ label, right, children, className }: { label: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[20px] border border-line bg-surface shadow-[var(--shadow-md)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
        <span className="truncate">{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Ricerca */

const RESULTS = [
  { name: "Salone Aurora", addr: "Via XX Settembre 18", km: "0,6", phone: "035 ··· 4418", site: true, open: "Aperto · fino alle 19:30", saved: true },
  { name: "Barberia Colleoni", addr: "Piazza Pontida 3", km: "1,1", phone: "035 ··· 0927", site: true, open: "Aperto · fino alle 20:00", saved: false },
  { name: "Hair Studio Gioia", addr: "Via Borgo Palazzo 92", km: "2,3", phone: "035 ··· 3361", site: false, open: "Chiude alle 13:00", saved: false },
  { name: "Acconciature Marisa", addr: "Via Corridoni 7", km: "3,8", phone: "035 ··· 7702", site: false, open: "Chiuso il lunedì", saved: false },
];

export function SearchMock() {
  return (
    <Frame label="Cerca clienti" right={<span className="hidden sm:inline">OpenStreetMap</span>}>
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.2fr_1fr_auto_auto]">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-ink/30 bg-bg px-3 text-[13.5px]">
            <Search className="h-4 w-4 text-ink-3" aria-hidden />parrucchieri<span className="-ml-1.5 h-4 w-px animate-pulse bg-accent" aria-hidden />
          </div>
          <div className="order-3 col-span-2 flex h-10 items-center gap-2 rounded-xl border border-line bg-bg px-3 text-[13.5px] sm:order-none sm:col-span-1">
            <MapPin className="h-4 w-4 text-ink-3" aria-hidden />Bergamo
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2 sm:hidden">5 km</span>
          </div>
          <div className="hidden h-10 items-center rounded-xl border border-line bg-bg px-3 font-mono text-[12px] text-ink-2 sm:flex">5 km</div>
          <div className="flex h-10 items-center rounded-xl bg-ink px-4 text-[13px] font-medium text-bg">Cerca</div>
        </div>
        <p className="mt-4 px-1 font-mono text-[11px] text-ink-3">24 attività trovate · ordinate per distanza</p>
        <ul className="mt-2 divide-y divide-line">
          {RESULTS.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-1 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 font-mono text-[12px] text-ink-2">{r.km}<span className="sr-only"> chilometri</span></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{r.name}</p>
                <p className="truncate text-[12px] text-ink-3">{r.addr}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden />{r.phone}</span>
                  {r.site && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" aria-hidden />sito</span>}
                  <span className="hidden items-center gap-1 sm:inline-flex"><Clock className="h-3 w-3" aria-hidden />{r.open}</span>
                </p>
              </div>
              <SaveToggle initial={r.saved} name={r.name} />
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------- Lead score */

const QUEUE = [
  { s: 91, n: "Studio Dentistico Ferri", t: "hot" },
  { s: 88, n: "Pasticceria Rinaldi", t: "hot" },
  { s: 74, n: "Salone Elsa", t: "warm" },
  { s: 38, n: "Bar Sport Lungolago", t: "cold" },
] as const;

export function ScoreMock() {
  return (
    <div className="relative">
      <Frame label="Lead score · Studio Dentistico Ferri">
        <div className="grid gap-6 p-5 pb-14 sm:grid-cols-[auto_1fr] sm:p-6 sm:pb-16">
          <div>
            <p className="font-display text-[96px] leading-[0.8] tracking-tight text-accent">91</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">su 100 · caldo</p>
            <div className="mt-3 flex gap-[3px]" aria-hidden>
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className={cn("h-5 w-[5px] rounded-full", i < 18 ? "bg-accent" : "bg-surface-2")} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink-3">Perché questo punteggio</p>
            <ul className="mt-2 space-y-2.5 text-[13.5px] leading-snug">
              {[
                ["+", "Seconda sede aperta a settembre: sta comprando ora"],
                ["+", "3 poltrone, il volume giusto per il tuo listino"],
                ["+", "Sul tuo giro del giovedì, a 2 km dal Bar Centrale"],
                ["−", "Nessun sito: non si capisce chi lo rifornisce oggi"],
              ].map(([sign, t]) => (
                <li key={t} className="flex gap-2.5">
                  <span className={cn("mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[12px]", sign === "+" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} aria-label={sign === "+" ? "a favore" : "contro"}>{sign}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-dashed border-line-strong pt-3 text-[11.5px] text-ink-3">
              Calibrato su: <span className="text-ink-2">forniture per studi dentistici</span> · cliente ideale <span className="text-ink-2">studi da 2 a 6 poltrone</span>
            </p>
          </div>
        </div>
      </Frame>
      <Reveal delay={0.15} className="relative z-10 -mt-9 ml-auto mr-3 w-[min(300px,88%)] rotate-[-1.2deg] sm:-mt-11 sm:mr-[-20px]">
        <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-[var(--shadow-md)]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Da chiamare oggi</p>
          <ol className="mt-2 space-y-1.5">
            {QUEUE.map((q, i) => (
              <li key={q.n} className="flex items-center gap-3 text-[13px]">
                <span className="w-3 font-mono text-[11px] text-ink-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{q.n}</span>
                <span className="rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums" style={{ color: `var(--${q.t})`, background: `color-mix(in oklab, var(--${q.t}) 14%, transparent)` }}>{q.s}</span>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </div>
  );
}

/* --------------------------------------------------------------- Briefing */

export function BriefingMock() {
  return (
    <Frame label="Briefing pre-visita" right={<span className="text-accent">pronto · 11:38</span>}>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <div>
            <p className="font-display text-[34px] leading-none">Pasticceria Rinaldi</p>
            <p className="mt-1.5 text-[12.5px] text-ink-2">Corso Garibaldi 8 · laboratorio artigianale dal 1987 · 2 punti vendita</p>
          </div>
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px] text-ink-2">score 88</span>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">Frase d&apos;apertura</p>
          <p className="mt-2 font-display text-[22px] italic leading-[1.25] sm:text-[25px]">
            «Ho visto che col secondo negozio il laboratorio lavora per due. Per Natale vi siete già organizzati?»
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Punti da toccare</p>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              <li>— Panettoni su prenotazione, li spingono sul sito <span className="ml-1 rounded bg-info-soft px-1 font-mono text-[10px] text-info">web</span></li>
              <li>— Consegne in 48 ore anche sulla seconda sede</li>
              <li>— Semilavorati: meno ore di laboratorio a dicembre</li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Domande da fare</p>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              <li>— Quanti panettoni avete fatto l&apos;anno scorso?</li>
              <li>— Chi decide gli acquisti per il secondo punto vendita?</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-surface-2 p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Obiezione probabile</p>
          <p className="mt-1.5 text-[14px] font-medium">«Abbiamo già il nostro fornitore.»</p>
          <p className="mt-1.5 text-[13.5px] leading-snug text-ink-2">
            <span className="text-accent">→</span> Non le chiedo di cambiarlo: proviamo una sola linea, quella delle feste, e a gennaio confrontiamo i numeri.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong pt-4">
          <p className="text-[13px]"><span className="text-ink-3">Offerta: </span><span className="font-medium">Kit prova Natale · −8% sul primo ordine</span></p>
          <span className="font-mono text-[11px] text-ink-3">lettura: 2 min</span>
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------- Assistente */

export function ChatMock() {
  return (
    <Frame label="Assistente" right={<span className="hidden sm:inline">conosce il tuo CRM</span>}>
      <div className="space-y-3 p-4 sm:p-5">
        <Reveal y={10} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13.5px] text-bg">
          Chi dovrei richiamare oggi?
        </Reveal>
        <Reveal y={10} delay={0.25} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-bg px-4 py-3 text-[13.5px] leading-relaxed">
          <p>Tre nomi, in quest&apos;ordine:</p>
          <ol className="mt-2 space-y-1.5">
            <li><span className="font-mono text-[12px] text-accent">1.</span> <strong className="font-semibold">Pasticceria Rinaldi</strong> — promemoria scaduto ieri, trattativa da 2.400 €.</li>
            <li><span className="font-mono text-[12px] text-accent">2.</span> <strong className="font-semibold">Studio Ferri</strong> — score 91, non l&apos;hai ancora chiamato.</li>
            <li><span className="font-mono text-[12px] text-accent">3.</span> <strong className="font-semibold">Salone Elsa</strong> — ha chiesto il listino 6 giorni fa.</li>
          </ol>
          <p className="mt-2 text-ink-2">Ti preparo il messaggio per Rinaldi?</p>
        </Reveal>
        <Reveal y={10} delay={0.5} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13.5px] text-bg">
          Sì, WhatsApp, breve e cordiale.
        </Reveal>
        <Reveal y={10} delay={0.75} className="max-w-[92%] rounded-2xl rounded-bl-md border border-dashed border-line-strong bg-surface px-4 py-3 text-[13.5px] leading-relaxed">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Bozza</p>
          <p className="mt-1">Buongiorno Giulia! Come promesso le giro il listino di Natale con il kit prova. Se le va passo giovedì mattina, così lo guardiamo insieme davanti a un caffè.</p>
        </Reveal>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Piano visite di giovedì", "Rispondi a «costa troppo»", "Cerca sul web"].map((c) => (
            <span key={c} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink-2">{c}</span>
          ))}
        </div>
        <div className="flex h-11 items-center gap-2 rounded-full border border-line-strong bg-bg pl-4 pr-1.5 text-[13px] text-ink-3">
          <span className="flex-1 truncate">Chiedi qualcosa sul tuo giro…</span>
          <span className="lp-typing flex gap-0.5" aria-hidden><span className="h-1 w-1 rounded-full bg-ink-3" /><span className="h-1 w-1 rounded-full bg-ink-3" /><span className="h-1 w-1 rounded-full bg-ink-3" /></span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-ink"><ArrowUp className="h-4 w-4" aria-hidden /></span>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------- Pipeline */

const COLS: { id: string; label: string; total: string; cards: { n: string; v: string; lift?: boolean }[] }[] = [
  { id: "new", label: "Nuovo", total: "—", cards: [{ n: "Acconciature Marisa", v: "—" }, { n: "Ottica Lanfranchi", v: "—" }] },
  { id: "contacted", label: "Contattato", total: "1.800 €", cards: [{ n: "Salone Elsa", v: "1.800 €" }] },
  { id: "qualified", label: "Qualificato", total: "3.100 €", cards: [{ n: "Studio Ferri", v: "3.100 €" }] },
  { id: "negotiation", label: "Trattativa", total: "9.300 €", cards: [{ n: "Pasticceria Rinaldi", v: "2.400 €", lift: true }, { n: "Hotel Belvedere", v: "6.900 €" }] },
  { id: "won", label: "Vinto", total: "4.750 €", cards: [{ n: "Bar Centrale", v: "1.250 €" }, { n: "Ferramenta Bonetti", v: "3.500 €" }] },
];

export function PipelineMock() {
  return (
    <Frame
      label="Pipeline"
      right={<span className="inline-flex items-center gap-1 normal-case tracking-normal"><Download className="h-3 w-3" aria-hidden />CSV</span>}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
        <p className="font-display text-[30px] leading-none">14.200 € <span className="italic text-ink-3">aperti</span></p>
        <p className="font-mono text-[11px] text-ink-3">8 schede · aggiornata ora</p>
      </div>
      <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-5" tabIndex={0} aria-label="Esempio di pipeline: scorri in orizzontale">
        <div className="grid min-w-[620px] grid-cols-5 gap-2.5">
          {COLS.map((c) => (
            <div key={c.id} className="rounded-xl bg-surface-2 p-2">
              <div className="px-1 pb-2 pt-0.5">
                <p className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--stage-${c.id})` }} aria-hidden />
                  <span className="truncate text-[11.5px] font-medium">{c.label}</span>
                </p>
                <p className="mt-0.5 pl-3.5 font-mono text-[10px] text-ink-3">{c.total}</p>
              </div>
              <div className="space-y-1.5">
                {c.cards.map((k) => (
                  <div
                    key={k.n}
                    className={cn(
                      "rounded-lg border border-line bg-surface p-2 text-[11.5px] transition-transform",
                      k.lift && "relative z-10 translate-x-3 -translate-y-1 rotate-[3deg] border-accent shadow-[var(--shadow-md)]",
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <span className="min-w-0 flex-1 leading-tight">{k.n}</span>
                      {k.lift && <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />}
                    </div>
                    <p className="mt-1 font-mono text-[10.5px] text-ink-3">{k.v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
