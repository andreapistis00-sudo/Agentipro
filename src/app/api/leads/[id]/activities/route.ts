import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { notFound, parseBody } from "@/lib/crm/api";
import { ActivityCreate } from "@/lib/crm/schemas";
import { getLead, toActivityDTO } from "@/lib/crm/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!(await getLead(user.id, id))) return notFound();
  const activities = await db.activity.findMany({ where: { userId: user.id, leadId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ activities: activities.map(toActivityDTO) });
}

/** POST { type: note|call|email|meeting|task, content, dueAt?, done? }. Le attività senza scadenza nascono già "fatte". */
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const body = await parseBody(req, ActivityCreate);
  if (body instanceof NextResponse) return body;
  if (!(await getLead(user.id, id))) return notFound();
  const dueAt = body.dueAt ?? null;
  const done = body.done ?? (body.type === "task" || dueAt ? false : true);
  const [activity] = await db.$transaction([
    db.activity.create({ data: { userId: user.id, leadId: id, type: body.type, content: body.content, dueAt, done } }),
    db.lead.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ activity: toActivityDTO(activity) }, { status: 201 });
}
