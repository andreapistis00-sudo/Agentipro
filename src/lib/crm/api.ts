import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { zodError } from "./schemas";

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const notFound = (what = "Cliente") => bad(`${what} non trovato`, 404);

/** Legge e valida il body JSON. Restituisce i dati o una risposta 400. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | NextResponse> {
  const raw = await req.json().catch(() => undefined);
  if (raw === undefined) return bad("Body JSON non valido");
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : bad(zodError(parsed.error));
}
