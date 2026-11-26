import { test as base, expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";

let counter = 0;

export type TestUser = { name: string; email: string; password: string; id?: string };

export function uniqueUser(label = "u"): TestUser {
  const n = `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { name: `Test ${label} Utente`, email: `e2e-${label}-${n}@example.test`, password: "password-e2e-1234" };
}

/** Registra un utente via API e restituisce il cookie di sessione. */
export async function registerViaApi(baseURL: string, user: TestUser) {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post("/api/auth/register", { data: { name: user.name, email: user.email, password: user.password } });
  if (!res.ok()) throw new Error(`register fallita: ${res.status()} ${await res.text()}`);
  const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).find((v) => v.startsWith("ap_session="));
  await ctx.dispose();
  if (!setCookie) throw new Error("cookie di sessione assente");
  return setCookie.split(";")[0].slice("ap_session=".length);
}

export type AuthedFixtures = { user: TestUser; api: APIRequestContext; session: string };

/** Fixture: utente unico per test, già autenticato nel browser (cookie iniettato) e via API. */
export const test = base.extend<AuthedFixtures>({
  user: async ({}, use, testInfo) => {
    await use(uniqueUser(testInfo.project.name.slice(0, 3)));
  },
  session: async ({ user, baseURL }, use) => {
    await use(await registerViaApi(baseURL!, user));
  },
  context: async ({ context, session, baseURL }, use) => {
    await context.addCookies([{ name: "ap_session", value: session, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await use(context);
  },
  api: async ({ session, baseURL }, use) => {
    const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { cookie: `ap_session=${session}` } });
    await use(ctx);
    await ctx.dispose();
  },
});

/** Variante senza autenticazione automatica. */
export const anon = base;

export { expect };

export type LeadInput = Record<string, unknown> & { name: string };

export async function createLead(api: APIRequestContext, data: LeadInput) {
  const res = await api.post("/api/leads", { data });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).lead as { id: string; name: string; stage: string };
}

/** Raccoglie errori di console e di pagina (esclude rumore noto non legato all'app). */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
