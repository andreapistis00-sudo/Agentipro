import { anon as test, expect, collectErrors } from "./helpers";

test.describe("Landing", () => {
  test("si carica senza errori in console e la CTA porta a /register", async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const cta = page.locator("a:visible", { hasText: "Prova gratis" }).first();
    await expect(cta).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
    await cta.click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("button", { name: "Crea account gratuito" })).toBeVisible();
  });

  test("nessuno scroll orizzontale", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // scorre tutta la pagina per attivare gli elementi "reveal"
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
    });
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw, `scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw);
  });
});
