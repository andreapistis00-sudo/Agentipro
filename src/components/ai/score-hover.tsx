"use client";
import { useMemo, useRef, useState } from "react";
import { ScoreBadge } from "@/components/ui";
import { SCORE_DIMENSIONS, breakdownTitle, parseScoreBreakdown } from "@/lib/ai/scoring";
import { DimensionBars } from "./score-panel";

/**
 * ScoreBadge che, al passaggio del mouse o al focus, mostra le barre delle sei dimensioni.
 * Il riquadro è `position: fixed`, così non viene tagliato dai contenitori con overflow nascosto.
 */
export function ScoreHover({ score, scoreBreakdown, className }: { score: number | null; scoreBreakdown: string | null; className?: string }) {
  const breakdown = useMemo(() => parseScoreBreakdown(scoreBreakdown), [scoreBreakdown]);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  if (!breakdown || score == null) return <ScoreBadge score={score} className={className} />;

  const W = 240;
  const H = 40 + SCORE_DIMENSIONS.length * 28;
  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.bottom + 8 + H < window.innerHeight;
    setPos({ top: below ? r.bottom + 6 : Math.max(8, r.top - H - 6), left: Math.min(window.innerWidth - W - 8, Math.max(8, r.left + r.width / 2 - W / 2)) });
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      className="inline-flex rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-ink/10"
      onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}
      aria-label={`Punteggio ${score}/100 · ${breakdownTitle(breakdown)}`}
    >
      <ScoreBadge score={score} className={className} />
      {pos && (
        <span role="tooltip" className="fixed z-50 block rounded-xl border border-line bg-surface p-3 text-left shadow-pop" style={{ top: pos.top, left: pos.left, width: W }}>
          <span className="mb-2 flex items-baseline justify-between text-[12px] text-ink-3">
            <span>Punteggio per dimensione</span><span className="font-mono text-[13px] font-semibold text-ink">{score}</span>
          </span>
          <DimensionBars breakdown={breakdown} compact />
        </span>
      )}
    </span>
  );
}
