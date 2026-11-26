"use client";
import { useState } from "react";
import { Button, useToast } from "@/components/ui";

/** Avvia Stripe Checkout per il pacchetto e reindirizza alla pagina di pagamento. */
export function BuyButton({ packId, label, disabled, featured }: { packId: string; label: string; disabled: boolean; featured: boolean }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) throw new Error(data?.error ?? "Non è stato possibile avviare il pagamento.");
      window.location.assign(data.url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Pagamento non disponibile", "error");
      setLoading(false);
    }
  }

  return (
    <Button
      className="mt-6 w-full"
      variant={featured ? "secondary" : "outline"}
      onClick={buy}
      loading={loading}
      disabled={disabled}
      title={disabled ? "Pagamenti non ancora attivi" : undefined}
    >
      {label}
    </Button>
  );
}
