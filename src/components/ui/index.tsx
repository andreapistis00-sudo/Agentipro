"use client";
// Primitivi UI condivisi. Usare questi in tutta l'app per coerenza visiva.
import * as React from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { cn, scoreTone, stageLabel } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background,color,box-shadow,transform] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
        {
          primary: "bg-ink text-bg hover:bg-ink/85",
          secondary: "bg-accent text-accent-ink hover:brightness-95",
          outline: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
          ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
          danger: "bg-danger text-white hover:brightness-95",
        }[variant],
        { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]", icon: "h-9 w-9" }[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

const fieldBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-3 transition focus:outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/5 disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "py-2.5 min-h-[90px] resize-y", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "h-10 pr-8 appearance-none bg-[length:16px] bg-no-repeat bg-[right_10px_center]", className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f8b7e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...props}>
        {children}
      </select>
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius)] border border-line bg-surface shadow-card", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "success" | "danger" | "warn" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap",
        {
          neutral: "bg-surface-2 text-ink-2",
          accent: "bg-accent-soft text-accent",
          success: "bg-success-soft text-success",
          danger: "bg-danger-soft text-danger",
          warn: "bg-warn-soft text-warn",
          info: "bg-info-soft text-info",
        }[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Punteggio lead 0-100 con colore caldo/tiepido/freddo. */
export function ScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = scoreTone(score);
  const color = { hot: "var(--hot)", warm: "var(--warm)", cold: "var(--cold)", muted: "var(--ink-3)" }[tone];
  return (
    <span
      title={score == null ? "Non ancora valutato" : `Punteggio ${score}/100`}
      className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[12px] tabular-nums", className)}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {score == null ? "—" : score}
    </span>
  );
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2", className)}>
      <span className="h-2 w-2 rounded-full" style={{ background: `var(--stage-${stage})` }} aria-hidden />
      {stageLabel(stage)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-ink-3", className)} aria-label="Caricamento" />;
}

export function EmptyState({ icon, title, description, action, className }: {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-ink-2">{icon}</div>}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[34px] leading-none tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Dialog modale semplice e accessibile (Esc / click fuori per chiudere). */
export function Dialog({ open, onClose, title, children, className }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn("max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-pop sm:max-w-lg sm:rounded-3xl", className)}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Toast minimale ---------- */
type ToastAction = { href: string; label: string };
type Toast = { id: number; message: string; tone: "success" | "error" | "info"; action?: ToastAction };
const ToastCtx = React.createContext<(message: string, tone?: Toast["tone"], action?: ToastAction) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast["tone"] = "success", action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            "pointer-events-auto rounded-2xl px-4 py-2 text-center text-sm font-medium shadow-pop",
            t.tone === "error" ? "bg-danger text-white" : t.tone === "info" ? "bg-surface text-ink border border-line" : "bg-ink text-bg",
          )}>
            {t.message}
            {t.action && (
              <Link
                href={t.action.href}
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                className="ml-2 inline-block font-semibold underline underline-offset-2"
              >
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
