"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Micro-interazione del mockup di ricerca: "Salva nel CRM". */
export function SaveToggle({ initial = false, name }: { initial?: boolean; name: string }) {
  const [saved, setSaved] = useState(initial);
  return (
    <button
      type="button"
      onClick={() => setSaved((s) => !s)}
      aria-pressed={saved}
      aria-label={saved ? `${name} salvato nel CRM (esempio)` : `Salva ${name} nel CRM (esempio)`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-all duration-300",
        saved ? "bg-success-soft text-success" : "border border-line-strong bg-surface text-ink hover:border-ink",
      )}
    >
      {saved ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
      {saved ? "Salvato" : "Salva"}
    </button>
  );
}
