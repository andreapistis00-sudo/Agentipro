import { anon as test, expect, uniqueUser, isMobile } from "./helpers";
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

  test("registrazione con email già usata mostra errore", async ({ page, request }) => {
    const u = uniqueUser("dup");
    expect((await request.post("/api/auth/register", { data: u })).status()).toBe(200);
    await page.goto("/register");
    await page.getByLabel("Nome e cognome").fill(u.name);
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill(u.password);
    await page.getByRole("button", { name: "Crea account gratuito" }).click();
    await expect(page.getByRole("alert")).toContainText("Esiste già un account");
  });

  test("credenziali errate mostrano un errore", async ({ page, request }) => {
    const u = uniqueUser("bad");
    await request.post("/api/auth/register", { data: u });
    await page.goto("/login");
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill("password-sbagliata");
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.getByRole("alert")).toHaveText("Email o password errati");
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
