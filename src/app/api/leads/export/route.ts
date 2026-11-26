import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { bad } from "@/lib/crm/api";
import { toCsv } from "@/lib/crm/csv";
import { dayKey, fmtDate, parseTags } from "@/lib/crm/format";
import { parseLeadQuery, zodError } from "@/lib/crm/schemas";
import { leadOrderBy, leadWhere } from "@/lib/crm/server";
import { stageLabel } from "@/lib/utils";

/** GET /api/leads/export?<stessi filtri di GET /api/leads> → CSV (tutte le pagine). */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const q = parseLeadQuery(new URL(req.url).searchParams);
  if (!q.success) return bad(`Parametri di ricerca non validi (${zodError(q.error)})`);
  const leads = await db.lead.findMany({ where: leadWhere(user.id, q.data), orderBy: leadOrderBy(q.data.sort), take: 10_000 });

  const num = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
  const csv = toCsv(
    ["Nome", "Categoria", "Fase", "Punteggio", "Valore (€)", "Referente", "Ruolo", "Telefono", "Email", "Sito web", "Indirizzo", "Città", "Tag", "Prossimo follow-up", "Motivo perdita", "Note", "Fonte", "Creato il", "Aggiornato il"],
    leads.map((l) => [
      l.name, l.category, stageLabel(l.stage), l.score, num(l.value), l.contactName, l.contactRole, l.phone, l.email, l.website,
      l.address, l.city, parseTags(l.tags).join(", "), l.nextFollowUp ? fmtDate(l.nextFollowUp, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      l.lostReason, l.notes, l.source,
      fmtDate(l.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" }), fmtDate(l.updatedAt, { day: "2-digit", month: "2-digit", year: "numeric" }),
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clienti-agentipro-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
