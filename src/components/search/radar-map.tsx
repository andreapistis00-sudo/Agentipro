"use client";
// Mappa "radar" in SVG: punti proiettati attorno al centro della ricerca, senza tile esterne.
import * as React from "react";
import { projectKm } from "@/lib/search/geo";
import type { SearchCenter, SearchResultWithStatus } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const R = 92; // raggio utile del disco nel viewBox (-100..100)

export const resultKey = (r: { source: string; sourceId: string }) => `${r.source}|${r.sourceId}`;

function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;
}

export function RadarMap({
  center,
  radiusKm,
  results,
  selected,
  hovered,
  onHover,
  onPick,
  loading,
  className,
}: {
  center: SearchCenter | null;
  radiusKm: number;
  results: SearchResultWithStatus[];
  selected: Set<string>;
  hovered: string | null;
  onHover: (key: string | null) => void;
  onPick: (key: string) => void;
  loading?: boolean;
  className?: string;
}) {
  const points = React.useMemo(() => {
    if (!center) return [];
    return results.map((r) => {
      const { x, y } = projectKm(center, r);
      const scale = R / radiusKm;
      let px = x * scale;
      let py = -y * scale;
      const d = Math.hypot(px, py);
      if (d > R) {
        px = (px / d) * R;
        py = (py / d) * R;
      }
      return { key: resultKey(r), r, x: px, y: py };
    });
  }, [center, radiusKm, results]);

  const hoveredPoint = points.find((p) => p.key === hovered) ?? null;
  // Il punto in hover va disegnato per ultimo (sopra gli altri)
  const ordered = hoveredPoint ? [...points.filter((p) => p.key !== hovered), hoveredPoint] : points;

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("relative", className)}>
      <svg viewBox="-104 -104 208 208" className="block h-full w-full select-none" role="img"
        aria-label={center ? `Mappa delle ${results.length} attività entro ${formatKm(radiusKm)} da ${center.label}` : "Mappa della ricerca"}>
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--surface)" />
            <stop offset="100%" stopColor="var(--surface-2)" />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        <circle r={R + 4} fill="url(#radar-bg)" stroke="var(--line)" strokeWidth="0.6" />
        {rings.map((f) => (
          <circle key={f} r={R * f} fill="none" stroke="var(--line-strong)" strokeWidth={f === 1 ? 0.7 : 0.45}
            strokeDasharray={f === 1 ? undefined : "1.2 2"} />
        ))}
        <line x1={-R} y1="0" x2={R} y2="0" stroke="var(--line)" strokeWidth="0.45" />
        <line x1="0" y1={-R} x2="0" y2={R} stroke="var(--line)" strokeWidth="0.45" />

        {/* Etichette distanze */}
        {center && [0.5, 1].map((f) => (
          <text key={f} x={R * f * 0.7071 + 1.5} y={-R * f * 0.7071 - 1.5} fontSize="5" fill="var(--ink-3)" className="font-mono">
            {formatKm(radiusKm * f)}
          </text>
        ))}
        <text x="0" y={-R - 6} fontSize="5.5" textAnchor="middle" fill="var(--ink-3)" fontWeight="600">N</text>

        {/* Fascio rotante (decorativo) */}
        {(loading || points.length > 0) && (
          <g className={cn("origin-center", loading ? "animate-[spin_2.4s_linear_infinite]" : "animate-[spin_9s_linear_infinite]")}
            style={{ transformBox: "view-box", transformOrigin: "center" }}>
            <path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos(-Math.PI / 5)} ${R * Math.sin(-Math.PI / 5)} Z`} fill="url(#radar-sweep)" />
          </g>
        )}

        {/* Punti */}
        {ordered.map(({ key, r, x, y }) => {
          const isHover = key === hovered;
          const isSel = selected.has(key);
          const fill = r.alreadySaved ? "var(--success)" : isSel ? "var(--accent)" : "var(--ink-2)";
          return (
            <g key={key} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} className="cursor-pointer"
              onMouseEnter={() => onHover(key)} onMouseLeave={() => onHover(null)} onClick={() => onPick(key)}>
              <circle r="7" fill="transparent" />
              {isHover && <circle r="6.5" fill={fill} opacity="0.18" />}
              <circle r={isHover ? 3.6 : isSel ? 3 : 2.4} fill={fill} stroke="var(--surface)" strokeWidth={isHover ? 1.2 : 0.8}
                className="transition-[r] duration-150" />
            </g>
          );
        })}

        {/* Centro */}
        <circle r="5.5" fill="var(--accent)" opacity="0.15" />
        <circle r="2.6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1" />

        {/* Etichetta del punto in hover */}
        {hoveredPoint && <HoverLabel x={hoveredPoint.x} y={hoveredPoint.y} name={hoveredPoint.r.name} km={hoveredPoint.r.distanceKm} />}
      </svg>
    </div>
  );
}

function HoverLabel({ x, y, name, km }: { x: number; y: number; name: string; km: number }) {
  const text = name.length > 26 ? `${name.slice(0, 25)}…` : name;
  const w = Math.max(34, text.length * 3.25 + 26);
  const left = Math.min(Math.max(x - w / 2, -98), 98 - w);
  const above = y > -70;
  const top = above ? y - 17 : y + 8;
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height="10.5" rx="5.25" fill="var(--ink)" />
      <text x={left + 5} y={top + 7.1} fontSize="5.4" fill="var(--bg)" fontWeight="600">{text}</text>
      <text x={left + w - 5} y={top + 7.1} fontSize="4.8" fill="var(--bg)" opacity="0.65" textAnchor="end" className="font-mono">
        {formatKm(km)}
      </text>
    </g>
  );
}

export { formatKm };
