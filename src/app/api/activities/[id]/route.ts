import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { bad, notFound, parseBody } from "@/lib/crm/api";
import { ActivityPatch } from "@/lib/crm/schemas";
import { toActivityDTO } from "@/lib/crm/server";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { done?, content?, type?, dueAt? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const body = await parseBody(req, ActivityPatch);
  if (body instanceof NextResponse) return body;
  if (Object.keys(body).length === 0) return bad("Nessun campo da aggiornare");
  const existing = await db.activity.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound("Attività");
  if (existing.type === "stage" && (body.type || body.content)) return bad("I cambi di fase non sono modificabili");
  const activity = await db.activity.update({ where: { id }, data: body });
  return NextResponse.json({ activity: toActivityDTO(activity) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const { count } = await db.activity.deleteMany({ where: { id, userId: user.id } });
  if (!count) return notFound("Attività");
  return NextResponse.json({ ok: true });
}
