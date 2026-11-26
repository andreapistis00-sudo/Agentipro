import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Agentipro — Meno giri a vuoto, più strette di mano. Il CRM con l'AI per agenti di commercio.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f4f2ec";
const INK = "#15140f";
const INK2 = "#5d5a50";
const LINE = "#dedad0";
const ACCENT = "#ff4f1a";

const font = (f: string) => readFile(join(process.cwd(), "public/landing/fonts", f));

export default async function OpengraphImage() {
  const [serif, serifItalic, sans, mono] = await Promise.all([
    font("InstrumentSerif-Regular.ttf"),
    font("InstrumentSerif-Italic.ttf"),
    font("Geist-Medium.ttf"),
    font("GeistMono-Medium.ttf"),
  ]);

  const pins = [
    { x: 880, y: 170, n: 1, on: false },
    { x: 1010, y: 250, n: 2, on: false },
    { x: 940, y: 380, n: 3, on: true },
    { x: 1080, y: 470, n: 4, on: false },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, position: "relative", fontFamily: "Geist" }}>
        {/* Mappa stilizzata a destra */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          <path d="M760 640 C 820 520 760 420 880 330 S 1120 260 1220 120" fill="none" stroke="#6f8aa8" strokeOpacity="0.2" strokeWidth="34" />
          <path d="M800 -10 L 980 640 M720 300 L 1220 360 M1150 -10 L 900 640" fill="none" stroke="#c9c4b6" strokeWidth="12" />
          <path d="M800 -10 L 980 640 M720 300 L 1220 360 M1150 -10 L 900 640" fill="none" stroke={PAPER} strokeWidth="8" />
          <path d="M780 110 C 830 130 850 160 880 170 S 990 220 1010 250 S 930 340 940 380 S 1060 430 1080 470" fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" />
          {pins.map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r="22" fill={p.on ? ACCENT : PAPER} stroke={p.on ? ACCENT : INK} strokeWidth="3" />
            </g>
          ))}
        </svg>
        {pins.map((p) => (
          <div key={p.n} style={{ position: "absolute", left: p.x - 22, top: p.y - 22, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Geist Mono", fontSize: 20, color: p.on ? "#fff" : INK }}>
            {p.n}
          </div>
        ))}

        {/* Scheda lead */}
        <div style={{ position: "absolute", left: 720, top: 430, width: 300, display: "flex", flexDirection: "column", background: "#fbfaf7", border: `2px solid #c9c4b6`, borderRadius: 22, padding: "20px 22px", boxShadow: "0 12px 30px rgba(21,20,15,0.12)" }}>
          <div style={{ fontFamily: "Geist Mono", fontSize: 14, letterSpacing: 2, color: "#8f8b7e" }}>TAPPA 3 · 2,1 KM</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontFamily: "Instrument Serif", fontSize: 32, color: INK }}>Studio Ferri</div>
            <div style={{ fontFamily: "Geist Mono", fontSize: 30, color: ACCENT }}>91</div>
          </div>
          <div style={{ fontSize: 16, color: INK2, marginTop: 4 }}>Briefing pronto</div>
        </div>

        {/* Testo */}
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px", width: 720, height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="48" height="48" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="9" fill={INK} />
              <path d="M16 6.5 8.5 25h4l1.4-3.8h4.2L19.5 25h4L16 6.5Zm0 7.4 1.4 4.1h-2.8L16 13.9Z" fill={PAPER} />
              <circle cx="24.5" cy="8" r="3" fill={ACCENT} />
            </svg>
            <div style={{ fontSize: 30, color: INK, letterSpacing: -0.5 }}>Agentipro</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Instrument Serif", fontSize: 86, lineHeight: 0.95, color: INK, letterSpacing: -2 }}>Meno giri a vuoto.</div>
            <div style={{ fontFamily: "Instrument Serif Italic", fontSize: 86, lineHeight: 1.02, color: ACCENT, letterSpacing: -2 }}>Più strette di mano.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "Geist Mono", fontSize: 18, letterSpacing: 2.5, color: INK2, borderTop: `2px solid ${LINE}`, paddingTop: 22, width: 600 }}>
            IL CRM CON L&apos;AI PER AGENTI DI COMMERCIO
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif Italic", data: serifItalic, style: "italic", weight: 400 },
        { name: "Geist", data: sans, style: "normal", weight: 500 },
        { name: "Geist Mono", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
