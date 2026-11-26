import { ImageResponse } from "next/og";

// Favicon generata: stesso disegno di <LogoMark /> (src/components/app/logo.tsx),
// con i colori espliciti perché qui le variabili CSS non esistono.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="64" height="64" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="9" fill="#15140f" />
        <path d="M16 6.5 8.5 25h4l1.4-3.8h4.2L19.5 25h4L16 6.5Zm0 7.4 1.4 4.1h-2.8L16 13.9Z" fill="#f4f2ec" />
        <circle cx="24.5" cy="8" r="3" fill="#ff4f1a" />
      </svg>
    ),
    size,
  );
}
