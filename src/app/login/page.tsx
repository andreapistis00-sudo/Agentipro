import { Suspense } from "react";
import { AuthShell } from "@/components/app/auth-shell";
import { AuthForm } from "@/components/app/auth-form";

export const metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <AuthShell title="Bentornato." subtitle="Accedi per riprendere il tuo giro clienti.">
      <Suspense><AuthForm mode="login" /></Suspense>
    </AuthShell>
  );
}
