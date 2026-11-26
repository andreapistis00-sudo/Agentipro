import { test, expect } from "./helpers";

test("cerca 'bar' a Milano, salva 3 risultati nel CRM e risultano 'Già nel CRM'", async ({ page }) => {
  await page.goto("/app/search");
  await page.getByLabel("Cosa cerchi").fill("bar");
  await page.getByLabel("Dove").fill("Milano");
  await page.getByRole("search", { name: "Cerca attività" }).getByRole("button", { name: "Cerca" }).click();

  const checkboxes = page.getByRole("checkbox", { name: /^Seleziona (?!tutti)/ });
  await expect(checkboxes.first()).toBeVisible();
  expect(await checkboxes.count()).toBeGreaterThanOrEqual(3);

  const names: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cb = checkboxes.nth(i);
    names.push(((await cb.getAttribute("aria-label")) ?? "").replace("Seleziona ", ""));
    await cb.check();
  }
  const save = page.getByRole("button", { name: "Salva 3 nel CRM" });
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByText("3 attività salvate nel CRM")).toBeVisible();
  await expect(page.getByText("Già nel CRM").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Già nel CRM" })).toHaveCount(3);

  // anche dopo una nuova ricerca restano segnati come già nel CRM
  await page.reload();
  await page.getByLabel("Cosa cerchi").fill("bar");
  await page.getByLabel("Dove").fill("Milano");
  await page.getByRole("search", { name: "Cerca attività" }).getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByRole("link", { name: "Già nel CRM" })).toHaveCount(3);
  for (const n of names) await expect(page.getByText(n, { exact: true }).first()).toBeVisible();

  // e compaiono nell'elenco clienti
  const res = await page.request.get("/api/leads");
  const body = await res.json();
  expect(body.total ?? body.leads?.length).toBe(3);
});
