"use client";
// Gestione lato client della risposta 402 "Crediti esauriti" delle API AI.
import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export const NO_CREDITS_CODE = "INSUFFICIENT_CREDITS";
export const CREDITS_HREF = "/app/credits";

type NoCreditsBody = { error?: string; code?: string; needed?: number; balance?: number };

/** Errore lanciato dai client quando l'API risponde 402 per crediti insufficienti. */
export class NoCreditsError extends Error {
  readonly code = NO_CREDITS_CODE;
  constructor(readonly needed: number | null, readonly balance: number | null) {
    super(noCreditsMessage(needed, balance));
    this.name = "NoCreditsError";
  }
}

export function noCreditsMessage(needed?: number | null, balance?: number | null) {
  if (needed != null && balance != null) {
    return `Crediti esauriti: ne servono ${needed}, ne hai ${balance}. Ricarica per continuare a usare l'AI.`;
  }
  return "Crediti esauriti: ricarica per continuare a usare l'AI.";
}

/** Se `status`/`body` indicano crediti esauriti restituisce l'errore tipizzato, altrimenti null. */
export function noCreditsFrom(status: number, body: unknown): NoCreditsError | null {
  const b = (body ?? {}) as NoCreditsBody;
  if (status !== 402 && b.code !== NO_CREDITS_CODE) return null;
  return new NoCreditsError(typeof b.needed === "number" ? b.needed : null, typeof b.balance === "number" ? b.balance : null);
}

export const isNoCredits = (err: unknown): err is NoCreditsError => err instanceof NoCreditsError;

/** Azione da allegare ai toast. */
export const RECHARGE_ACTION = { href: CREDITS_HREF, label: "Ricarica crediti" };

export function RechargeLink({ className }: { className?: string }) {
  return (
    <Link
      href={CREDITS_HREF}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-[13px] font-medium text-bg transition hover:opacity-90",
        className,
      )}
    >
      <Coins className="h-3.5 w-3.5" aria-hidden />Ricarica crediti
    </Link>
  );
}
