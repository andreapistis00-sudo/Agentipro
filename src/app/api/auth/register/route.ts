import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { clientIp, rateLimit, tooMany } from "@/lib/search/rate-limit";

const Body = z.object({
  name: z.string().trim().min(2, "Inserisci il tuo nome").max(80),
  email: z.string().trim().toLowerCase().email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(200),
});

export async function POST(req: Request) {
  const limit = rateLimit(`register:${clientIp(req)}`, 50, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec, `Troppe registrazioni da questa rete. Riprova tra ${limit.retryAfterSec} secondi.`);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Esiste già un account con questa email" }, { status: 409 });
  }
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession({ uid: user.id, email, name }), sessionCookieOptions);
  return res;
}
