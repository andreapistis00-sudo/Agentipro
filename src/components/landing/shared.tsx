import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-[var(--lp-gutter)]", className)}>{children}</div>;
}

/** Etichetta di sezione stile giornale: "§ 02 — Cosa fa" */
export function Kicker({ n, children, className }: { n?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3", className)}>
      {n && <span className="text-accent">§ {n}</span>}
      {n && <span aria-hidden className="h-px w-6 bg-line-strong" />}
      <span>{children}</span>
    </p>
  );
}

export function H2({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("font-display text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[0.96] tracking-[-0.015em] text-balance", className)}>
      {children}
    </h2>
  );
}

export function CtaLink({
  href,
  children,
  variant = "accent",
  size = "md",
  className,
  arrow = true,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "accent" | "ink" | "outline" | "inverse";
  size?: "md" | "lg";
  className?: string;
  arrow?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background,color,transform,box-shadow] duration-200 active:scale-[0.98]",
        {
          accent: "bg-accent text-accent-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.14)] hover:brightness-[0.96]",
          ink: "bg-ink text-bg hover:bg-ink/85",
          outline: "border border-line-strong text-ink hover:bg-surface-2",
          inverse: "bg-bg text-ink hover:bg-surface",
        }[variant],
        { md: "h-10 px-4 text-sm", lg: "h-13 px-6 text-[15px]" }[size],
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  );
}
