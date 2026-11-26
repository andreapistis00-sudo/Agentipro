import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Utente corrente (o null). Per Server Components, Route Handlers e Server Actions. */
export async function getCurrentUser() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.uid } });
}

/** Per le pagine: reindirizza al login se non autenticato. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Per le API: restituisce l'utente oppure una risposta 401 già pronta.
 *   const auth = await requireApiUser(); if (auth instanceof NextResponse) return auth;
 */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
