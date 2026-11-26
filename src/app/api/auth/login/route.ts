import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { clientIp, peekRateLimit, rateLimit, tooMany } from "@/lib/search/rate-limit";

const FAIL_LIMIT = 10;
const FAIL_WINDOW = 10 * 60_000;

const Body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email o password non validi" }, { status: 400 });
  // Freno alla forza bruta: si contano solo i tentativi falliti, per account e per IP.
  const keys = [`login-fail:${parsed.data.email}`, `login-fail-ip:${clientIp(req)}`];
  const limits = [FAIL_LIMIT, FAIL_LIMIT * 5];
  for (let i = 0; i < keys.length; i++) {
    const limit = peekRateLimit(keys[i], limits[i], FAIL_WINDOW);
    if (!limit.ok) return tooMany(limit.retryAfterSec, `Troppi tentativi di accesso. Riprova tra ${limit.retryAfterSec} secondi.`);
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    keys.forEach((k, i) => rateLimit(k, limits[i], FAIL_WINDOW));
    return NextResponse.json({ error: "Email o password errati" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    await signSession({ uid: user.id, email: user.email, name: user.name }),
    sessionCookieOptions,
  );
  return res;
}
