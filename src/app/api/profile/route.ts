import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const Body = z.object({
  name: z.string().trim().min(2).max(80),
  company: opt(120),
  sector: opt(120),
  products: opt(2000),
  idealCustomer: opt(1000),
  territory: opt(200),
  tone: opt(120),
});

export async function PATCH(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
