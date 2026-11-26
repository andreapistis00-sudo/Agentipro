import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { scoreLeads } from "@/lib/ai/score";
import { ScoreRequestSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/ai/score — body { leadIds: string[] } (max 50, solo lead dell'utente).
 * Risposta: { results: [{ leadId, score, summary }], errors?: [{ leadId, error }], demo }
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = ScoreRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });

  const out = await scoreLeads(user, parsed.data.leadIds);
  if (!out.results.length && out.errors?.length) {
    const notFound = out.errors.every((e) => e.error === "Cliente non trovato");
    return NextResponse.json({ ...out, error: notFound ? "Cliente non trovato" : out.errors[0].error }, { status: notFound ? 404 : 502 });
  }
  return NextResponse.json(out);
}
