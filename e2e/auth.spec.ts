import { anon as test, expect, uniqueUser, isMobile, registerViaApi } from "./helpers";
import { test as authed } from "./helpers";

test.describe("Autenticazione", () => {
  test("registrazione, logout e nuovo login", async ({ page }) => {
    const u = uniqueUser("auth");
    await page.goto("/register");
    await page.getByLabel("Nome e cognome").fill(u.name);
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill(u.password);
    await page.getByRole("button", { name: "Crea account gratuito" }).click();
    await expect(page).toHaveURL(/\/app\/settings\?welcome=1$/);
    await expect(page.getByText("Benvenuto in Agentipro")).toBeVisible();

    if (isMobile(page)) {
      // la sidebar con il pulsante "Esci" è solo desktop: si esce cancellando la sessione via API
      await page.request.post("/api/auth/logout");
      await page.goto("/app");
    } else {
      await page.getByRole("button", { name: "Esci" }).click();
    }
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);

    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill(u.password);
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(u.name.split(" ")[0]);
  });

  test("registrazione con email già usata mostra errore", async ({ page, baseURL }) => {
    const u = uniqueUser("dup");
    await registerViaApi(baseURL!, u);
    await page.goto("/register");
    await page.getByLabel("Nome e cognome").fill(u.name);
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill(u.password);
    await page.getByRole("button", { name: "Crea account gratuito" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("Esiste già un account");
  });

  test("credenziali errate mostrano un errore", async ({ page, baseURL }) => {
    const u = uniqueUser("bad");
    await registerViaApi(baseURL!, u);
    await page.goto("/login");
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill("password-sbagliata");
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.locator("form [role=alert]")).toHaveText("Email o password errati");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/app senza login reindirizza a /login", async ({ page }) => {
    await page.goto("/app/leads");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fleads$/);
    const res = await page.request.get("/api/leads");
    expect(res.status()).toBe(401);
  });
});

authed.describe("Sessione", () => {
  authed("utente autenticato su /login viene portato a /app", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe("Forza bruta", () => {
  test("dopo troppi tentativi falliti il login è bloccato (429)", async ({ playwright, baseURL }) => {
    const u = uniqueUser("brute");
    await registerViaApi(baseURL!, u);
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.9.9` } });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await ctx.post("/api/auth/login", { data: { email: u.email, password: "sbagliata" + i } })).status());
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
    // anche con la password giusta resta bloccato nella finestra
    expect((await ctx.post("/api/auth/login", { data: { email: u.email, password: u.password } })).status()).toBe(429);
    await ctx.dispose();
  });
});
