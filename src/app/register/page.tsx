import { Suspense } from "react";
import { AuthShell } from "@/components/app/auth-shell";
import { AuthForm } from "@/components/app/auth-form";

export const metadata = { title: "Crea account" };

export default function RegisterPage() {
  return (
    <AuthShell title="Inizia in due minuti." subtitle="Crea il tuo account. Nessuna carta di credito richiesta.">
      <Suspense><AuthForm mode="register" /></Suspense>
    </AuthShell>
  );
}
