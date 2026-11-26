import { cn } from "@/lib/utils";

/** Marchio Agentipro: una "A" che è anche un segnaposto mappa. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="M16 6.5 8.5 25h4l1.4-3.8h4.2L19.5 25h4L16 6.5Zm0 7.4 1.4 4.1h-2.8L16 13.9Z" fill="var(--bg)" />
      <circle cx="24.5" cy="8" r="3" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[17px]">Agentipro</span>
    </span>
  );
}
