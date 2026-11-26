"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Clock, Phone, NotebookPen } from "lucide-react";

type Stop = {
  n: number;
  x: number;
  y: number;
  name: string;
  kind: string;
  street: string;
  km: string;
  score: number;
  why: string[];
  labelDx: number;
  labelDy: number;
  anchor?: "start" | "end";
};

const STOPS: Stop[] = [
  { n: 1, x: 236, y: 190, name: "Bar Centrale", kind: "Bar caffetteria", street: "Piazza Duomo 4", km: "0,8 km", score: 82, why: ["Aperto 6:30–21, 7 giorni su 7", "4,6/5 su 320 recensioni"], labelDx: -22, labelDy: -6, anchor: "end" },
  { n: 2, x: 372, y: 148, name: "Salone Elsa", kind: "Parrucchiere", street: "Via Mazzini 31", km: "1,4 km", score: 74, why: ["4 postazioni, sito aggiornato", "Recensioni in crescita"], labelDx: 22, labelDy: -10 },
  { n: 3, x: 452, y: 292, name: "Studio Dentistico Ferri", kind: "Studio dentistico", street: "Viale Venezia 12", km: "2,1 km", score: 91, why: ["Seconda sede aperta a settembre", "In linea con il tuo cliente ideale"], labelDx: -24, labelDy: 5, anchor: "end" },
  { n: 4, x: 316, y: 354, name: "Pasticceria Rinaldi", kind: "Pasticceria", street: "Corso Garibaldi 8", km: "2,6 km", score: 88, why: ["Laboratorio interno, 2 punti vendita", "Titolare citata dal giornale locale"], labelDx: -22, labelDy: 24, anchor: "end" },
  { n: 5, x: 160, y: 478, name: "Ferramenta Bonetti", kind: "Ferramenta", street: "Via del Porto 2", km: "3,9 km", score: 63, why: ["Attività storica, dal 1962", "Orari ridotti il lunedì"], labelDx: -12, labelDy: -26 },
];

const ROUTE =
  "M84 104 C 130 120 170 160 236 190 C 290 214 330 160 372 148 C 420 136 440 230 452 292 C 462 340 380 346 316 354 C 250 362 220 420 160 478";

/** Strada con "bordo" e carreggiata, come su una carta stradale. */
function Road({ d, w = 11 }: { d: string; w?: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="var(--line-strong)" strokeWidth={w} />
      <path d={d} stroke="var(--surface)" strokeWidth={w - 3.5} />
    </g>
  );
}

const MINOR = [
  "M205 210 L 420 230", "M210 270 L 430 262", "M240 140 L 260 360", "M330 118 L 345 372", "M190 310 L 400 320",
  "M400 160 L 392 350", "M40 300 L 150 260", "M60 360 L 175 330", "M470 120 L 560 210", "M480 180 L 590 200",
  "M60 520 L 260 470", "M90 560 L 280 520", "M230 470 L 250 600", "M440 520 L 600 500", "M420 560 L 600 560",
  "M100 40 L 260 70", "M380 40 L 520 60",
];

export function RouteMap() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(2);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (reduce) { setDrawn(true); return; }
    const t = setTimeout(() => setDrawn(true), 2900);
    return () => clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (!drawn || reduce) return;
    const order = [2, 3, 0, 1, 4];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % order.length; setActive(order[i]); }, 4200);
    return () => clearInterval(id);
  }, [drawn, reduce]);

  const stop = STOPS[active];
  const drawDur = reduce ? 0 : 2.4;

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-md)]">
        {/* Intestazione del foglio */}
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3 sm:px-5">
          <span>Giro di martedì<span className="hidden min-[420px]:inline"> · Brescia Est</span></span>
          <span className="hidden sm:inline">5 visite · 23 km</span>
          <span className="sm:hidden">5 visite</span>
        </div>

        <svg viewBox="0 0 600 600" className="block h-auto w-full" role="img" aria-labelledby="lp-map-title">
          <title id="lp-map-title">Mappa del giro visite: cinque attività collegate da un percorso, ognuna con il suo punteggio</title>
          <defs>
            <pattern id="lp-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="1.2" fill="var(--line)" />
            </pattern>
          </defs>
          <rect width="600" height="600" fill="url(#lp-dots)" />

          {/* Fiume */}
          <path d="M-20 455 C 110 400 190 520 320 452 S 520 360 620 400" fill="none" stroke="var(--cold)" strokeOpacity="0.22" strokeWidth="30" strokeLinecap="round" />
          <path d="M-20 455 C 110 400 190 520 320 452 S 520 360 620 400" fill="none" stroke="var(--cold)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 7" />
          <text x="520" y="368" className="lp-map-label" fontSize="11" fontStyle="italic" fill="var(--cold)" fontFamily="var(--font-display)" transform="rotate(-12 520 368)">fiume Mella</text>

          {/* Parco */}
          <rect x="470" y="440" width="104" height="78" rx="16" fill="var(--success-soft)" />
          <text x="522" y="484" textAnchor="middle" className="lp-map-label" fontSize="10" letterSpacing="1.5" fill="var(--success)" fontFamily="var(--font-mono)">PARCO</text>

          {/* Vie minori */}
          <g stroke="var(--line)" strokeWidth="3" strokeLinecap="round" fill="none">
            {MINOR.map((d) => <path key={d} d={d} />)}
          </g>

          {/* Radiali e circonvallazione */}
          <Road d="M300 100 L 296 -20" />
          <Road d="M428 170 L 620 92" />
          <Road d="M452 262 L 620 286" />
          <Road d="M404 344 L 520 620" />
          <Road d="M200 334 L 110 620" />
          <Road d="M160 250 L -20 226" />
          <Road d="M192 166 L 60 -20" />
          <Road d="M182 168 Q 300 84 424 160 Q 476 252 410 344 Q 300 396 192 334 Q 140 252 182 168 Z" w={13} />

          {/* Piazza */}
          <rect x="280" y="228" width="40" height="30" rx="4" fill="var(--surface-2)" stroke="var(--line-strong)" transform="rotate(-6 300 243)" />

          {/* Percorso: previsto (tratteggiato) e percorso (pieno, si disegna) */}
          <path d={ROUTE} fill="none" stroke="var(--ink-3)" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
          <motion.path
            d={ROUTE}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: drawDur, delay: reduce ? 0 : 0.5, ease: [0.45, 0, 0.2, 1] }}
          />

          {/* Partenza */}
          <g transform="translate(84 104)">
            <rect x="-13" y="-13" width="26" height="26" rx="7" fill="var(--ink)" />
            <text y="4.5" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--bg)" fontFamily="var(--font-sans)">P</text>
            <text x="20" y="-14" className="lp-map-label lp-halo" fontSize="12" fill="var(--ink-2)" fontFamily="var(--font-sans)">Partenza 8:30</text>
          </g>

          {/* Tappe */}
          {STOPS.map((s, i) => {
            const isActive = drawn && i === active;
            return (
              <motion.g
                key={s.n}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? { duration: 0 } : { delay: 0.6 + (drawDur * (i + 1)) / 5.3, type: "spring", stiffness: 320, damping: 18 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                {isActive && <circle cx={s.x} cy={s.y} r="16" fill="var(--accent)" className="lp-pulse" />}
                <circle cx={s.x} cy={s.y} r="16" fill={isActive ? "var(--accent)" : "var(--surface)"} stroke={isActive ? "var(--accent)" : "var(--ink)"} strokeWidth="2" style={{ transition: "fill .3s" }} />
                <text x={s.x} y={s.y + 4.8} textAnchor="middle" fontSize="14" fontWeight="600" fill={isActive ? "var(--accent-ink)" : "var(--ink)"} fontFamily="var(--font-mono)" style={{ transition: "fill .3s" }}>
                  {s.n}
                </text>
                <text x={s.x + s.labelDx} y={s.y + s.labelDy} textAnchor={s.anchor ?? "start"} className="lp-map-label lp-halo" fontSize="13" fontWeight="500" fill="var(--ink)" fontFamily="var(--font-sans)">
                  {s.name}
                  <tspan dx="6" fill={s.score >= 80 ? "var(--accent)" : "var(--ink-3)"} fontFamily="var(--font-mono)" fontSize="12">{s.score}</tspan>
                </text>
              </motion.g>
            );
          })}

          {/* Rosa dei venti e scala */}
          <g transform="translate(560 44)" fontFamily="var(--font-mono)">
            <circle r="17" fill="var(--surface)" stroke="var(--line-strong)" />
            <path d="M0 -11 L 5 4 L 0 1 L -5 4 Z" fill="var(--ink)" />
            <text y="13" textAnchor="middle" fontSize="8" fill="var(--ink-3)">N</text>
          </g>
          <g transform="translate(30 572)" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-3)">
            <path d="M0 0 H 80" stroke="var(--ink-2)" strokeWidth="2" />
            <path d="M0 -4 V 4 M40 -3 V 3 M80 -4 V 4" stroke="var(--ink-2)" strokeWidth="1.5" />
            <text x="90" y="4">500 m</text>
          </g>
        </svg>
      </div>

      {/* Scheda del lead attivo */}
      <div
        className="relative z-10 mx-3 -mt-14 sm:ml-auto sm:mr-6 sm:w-[330px] xl:absolute xl:-right-12 xl:-bottom-10 xl:mx-0 xl:mt-0 xl:w-[316px]"
        aria-live="polite"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { delay: 2.2, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-2xl border border-line-strong bg-surface p-4 shadow-[var(--shadow-md)]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stop.n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 0.35 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">Tappa {stop.n} · {stop.km}</p>
                  <p className="mt-1 truncate font-display text-[22px] leading-tight">{stop.name}</p>
                  <p className="truncate text-[12.5px] text-ink-2">{stop.kind} · {stop.street}</p>
                </div>
                <ScoreDial score={stop.score} animateIn={!reduce} />
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-dashed border-line-strong pt-3 text-[12.5px] text-ink-2">
                {stop.why.map((w) => (
                  <li key={w} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />{w}</li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 font-medium text-accent"><NotebookPen className="h-3 w-3" aria-hidden />Scheda AI pronta</span>
                <span className="inline-flex items-center gap-1 text-ink-3"><Phone className="h-3 w-3" aria-hidden />Chiama</span>
                <span className="inline-flex items-center gap-1 text-ink-3"><Clock className="h-3 w-3" aria-hidden />Aperto</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Promemoria che arriva */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduce ? { duration: 0 } : { delay: 3.2, duration: 0.6 }}
        className="absolute -left-16 top-[44%] hidden w-[220px] -rotate-[1.5deg] rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-md)] xl:block"
        aria-hidden
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Promemoria · 17:00</p>
        <p className="mt-1 text-[13px] leading-snug">Richiama Rinaldi per il listino di Natale</p>
      </motion.div>
    </div>
  );
}

function ScoreDial({ score, animateIn }: { score: number; animateIn: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!animateIn) { setShown(score); return; }
    const c = animate(0, score, { duration: 1.1, ease: [0.2, 0.7, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [score, animateIn]);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const tone = score >= 80 ? "var(--accent)" : score >= 60 ? "var(--warm)" : "var(--cold)";
  return (
    <div className="relative grid h-[58px] w-[58px] shrink-0 place-items-center" aria-label={`Punteggio ${score} su 100`} role="img">
      <svg viewBox="0 0 54 54" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="27" cy="27" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        <circle cx="27" cy="27" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)} />
      </svg>
      <span className="font-mono text-[17px] font-semibold tabular-nums" aria-hidden>{shown}</span>
    </div>
  );
}
