import Link from "next/link";
import { Logo } from "./logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-[44px] leading-[1.02] tracking-tight">{title}</h1>
          <p className="mb-8 mt-3 text-[15px] text-ink-2">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(var(--bg) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex h-full flex-col justify-end p-14 text-bg">
          <p className="font-display text-[52px] leading-[1.02] tracking-tight">
            Meno ore in macchina<br />a caso. <span className="italic text-accent">Più firme.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-bg/70">
            Agentipro trova le attività della tua zona, ti dice chi chiamare per primo e prepara ogni visita al posto tuo.
          </p>
        </div>
      </div>
    </div>
  );
}
