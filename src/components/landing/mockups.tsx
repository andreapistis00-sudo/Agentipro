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

const DIMS = [
  { l: "Aderenza", s: 97, w: 5, r: "Studio dentistico: il tuo cliente ideale" },
  { l: "Dimensione", s: 85, w: 3, r: "Due sedi, 6 poltrone in totale" },
  { l: "Reputazione", s: 88, w: 3, r: "4,8/5 su 214 recensioni" },
  { l: "Presenza online", s: 82, w: 2, r: "Sito, telefono ed email pubblici" },
  { l: "Vicinanza", s: 96, w: 3, r: "A 2 km dal tuo giro del giovedì" },
  { l: "Completezza dati", s: 90, w: 1, r: "Scheda AI con 7 fonti" },
];

function Dots({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="flex gap-[3px]" aria-label={`peso ${n} su ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < n ? "bg-accent" : "bg-surface-2")} />
      ))}
    </span>
  );
}

export function ScoreMock() {
  return (
    <div className="relative">
      <Frame label="Punteggio AI · Studio Dentistico Ferri" right={<span className="hidden text-success sm:inline">affidabilità alta</span>}>
        <div className="grid gap-6 p-5 pb-16 sm:grid-cols-[auto_1fr] sm:p-6 sm:pb-20">
          <div>
            <p className="font-display text-[96px] leading-[0.8] tracking-tight text-accent">91</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">su 100 · media pesata</p>
            <p className="mt-4 max-w-[180px] text-[12.5px] leading-snug text-ink-2">Il totale lo calcola l&apos;app, con i pesi che scegli tu.</p>
          </div>
          <ul className="space-y-2.5" aria-label="Punteggio per dimensione">
            {DIMS.map((d) => (
              <li key={d.l}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-medium">{d.l}</span>
                  <span className="font-mono font-semibold tabular-nums">{d.s}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${d.s}%`, background: d.s >= 75 ? "var(--hot)" : "var(--warm)" }} />
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{d.r}</p>
              </li>
            ))}
          </ul>
        </div>
      </Frame>
      <Reveal delay={0.15} className="relative z-10 -mt-12 ml-auto mr-3 w-[min(290px,88%)] rotate-[-1.2deg] sm:-mt-14 sm:mr-[-20px]">
        <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-[var(--shadow-md)]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">I tuoi pesi · profilo</p>
          <ul className="mt-2.5 space-y-1.5">
            {DIMS.map((d) => (
              <li key={d.l} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 truncate">{d.l}</span>
                <Dots n={d.w} />
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-dashed border-line-strong pt-2.5 text-[11.5px] leading-snug text-ink-2">
            «Conta di più se ha almeno due sedi; meno se è una catena.»
          </p>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- Scheda AI */

export function ResearchMock() {
  return (
    <Frame label="Scheda AI · Pasticceria Rinaldi" right={<span className="text-success">affidabilità alta · 7 fonti</span>}>
      <div className="p-5 sm:p-7">
        <div className="border-b border-line pb-4">
          <p className="font-display text-[34px] leading-none">Pasticceria Rinaldi</p>
          <p className="mt-1.5 text-[12.5px] text-ink-2">Corso Garibaldi 8 · laboratorio artigianale dal 1987 · 2 punti vendita</p>
        </div>

        <p className="mt-4 text-[14.5px] leading-relaxed">
          Pasticceria con laboratorio interno, nota per lievitati e torte su ordinazione. Il secondo punto vendita, in Via Mazzini, è aperto da marzo 2024.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Persone</p>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              <li><span className="font-medium">Giulia Rinaldi</span> — titolare <span className="ml-1 rounded bg-info-soft px-1 font-mono text-[10px] text-info">articolo locale</span></li>
              <li><span className="font-medium">Marco Rinaldi</span> — capo pasticcere <span className="ml-1 rounded bg-info-soft px-1 font-mono text-[10px] text-info">sito</span></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Online</p>
            <p className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-[20px] font-semibold">4,7</span><span className="text-[12px] text-ink-3">/5 su Google · 412 recensioni</span></p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["Sito", "Instagram", "TheFork 4,5"].map((c) => (
                <span key={c} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">{c}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-success">Nelle recensioni piace</p>
            <ul className="mt-1.5 space-y-1 text-[13px]"><li>+ Lievitati e brioche</li><li>+ Torte personalizzate</li></ul>
          </div>
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-danger">Critiche ricorrenti</p>
            <ul className="mt-1.5 space-y-1 text-[13px]"><li>− Attesa al banco nel weekend</li><li>− Pochi posti a sedere</li></ul>
          </div>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">Fatti e segnali</p>
          <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
            <li>— Premio per il panettone artigianale a un concorso regionale, 2025 <span className="ml-1 rounded bg-info-soft px-1 font-mono text-[10px] text-info">web</span></li>
            <li>— Aperta 7 giorni su 7, ordini online per le feste <span className="ml-1 rounded bg-info-soft px-1 font-mono text-[10px] text-info">sito</span></li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong pt-4">
          <p className="text-[13px]"><span className="text-ink-3">Da verificare: </span><span className="font-medium">numero di dipendenti</span></p>
          <span className="font-mono text-[11px] text-ink-3">aggiornata oggi</span>
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
          Quali clienti in Trattativa non sento da due settimane?
        </Reveal>
        <Reveal y={10} delay={0.25} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-bg px-4 py-3 text-[13.5px] leading-relaxed">
          <p>Tre, senza chiamate, email o visite registrate dal 12 novembre:</p>
          <ul className="mt-2 space-y-1.5">
            <li><strong className="font-semibold">Pasticceria Rinaldi</strong> — ultimo contatto 6 nov · punteggio 88</li>
            <li><strong className="font-semibold">Hotel Belvedere</strong> — ultimo contatto 3 nov · punteggio 79</li>
            <li><strong className="font-semibold">Ottica Lanfranchi</strong> — nessun contatto registrato · punteggio 64</li>
          </ul>
        </Reveal>
        <Reveal y={10} delay={0.5} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13.5px] text-bg">
          Cosa sai dell&apos;Hotel Belvedere?
        </Reveal>
        <Reveal y={10} delay={0.75} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-bg px-4 py-3 text-[13.5px] leading-relaxed">
          <p>Tre stelle, 42 camere, ristrutturato nel 2025. Su Google 4,4/5 su 860 recensioni: apprezzate colazione e posizione, critiche sul parcheggio.</p>
          <p className="mt-2 font-mono text-[11px] text-ink-3">Fonti: sito ufficiale · Google · Booking</p>
        </Reveal>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Confronta i 5 con punteggio più alto", "Riassumi le note su Rinaldi", "Cerca sul web"].map((c) => (
            <span key={c} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink-2">{c}</span>
          ))}
        </div>
        <div className="flex h-11 items-center gap-2 rounded-full border border-line-strong bg-bg pl-4 pr-1.5 text-[13px] text-ink-3">
          <span className="flex-1 truncate">Chiedi qualcosa sui tuoi clienti…</span>
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
