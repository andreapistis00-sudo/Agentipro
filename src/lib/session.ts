// Firma/verifica JWT della sessione. Nessuna dipendenza da Node: usabile anche nel middleware (edge).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ap_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET non impostato");
  return new TextEncoder().encode(s || "dev-only-insecure-secret");
}

export type SessionPayload = { uid: string; email: string; name: string };

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, email: String(payload.email), name: String(payload.name) };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
