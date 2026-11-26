"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setLoading(false);
    if (!res) return setError("Connessione non disponibile. Riprova.");
    if (!res.ok) return setError(data.error ?? "Qualcosa è andato storto");
    const next = params.get("next");
    // Solo percorsi interni all'app (niente "//host" o URL assoluti).
    const safeNext = next && /^\/app(?:[/?#]|$)/.test(next) ? next : "/app";
    router.push(mode === "register" ? "/app/settings?welcome=1" : safeNext);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "register" && (
        <Field label="Nome e cognome" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required placeholder="Mario Rossi" />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="mario@esempio.it" />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === "register" ? "Almeno 8 caratteri" : undefined}>
        <Input id="password" name="password" type="password" required minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"} />
      </Field>
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {mode === "login" ? "Accedi" : "Crea account gratuito"}
      </Button>
      <p className="text-center text-sm text-ink-2">
        {mode === "login" ? (
          <>Non hai un account? <Link href="/register" className="font-medium text-ink underline underline-offset-4">Registrati</Link></>
        ) : (
          <>Hai già un account? <Link href="/login" className="font-medium text-ink underline underline-offset-4">Accedi</Link></>
        )}
      </p>
    </form>
  );
}
