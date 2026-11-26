import { test, expect, createLead } from "./helpers";
import type { APIRequestContext } from "@playwright/test";

async function importFromSearch(api: APIRequestContext, count: number) {
  const s = await api.post("/api/search", { data: { query: "bar", location: "Milano", radiusKm: 5 } });
  expect(s.ok(), await s.text()).toBeTruthy();
  const results = (await s.json()).results.slice(0, count);
  const imp = await api.post("/api/leads/import", { data: { results } });
  expect(imp.ok(), await imp.text()).toBeTruthy();
  return results as { name: string }[];
}

test.describe("Clienti", () => {
  test("lista mostra i lead importati e la ricerca testuale filtra", async ({ page, api }) => {
    const imported = await importFromSearch(api, 3);
    await createLead(api, { name: "Pasticceria Zefiro Unica", category: "Pasticceria", city: "Torino" });

    await page.goto("/app/leads");
    await expect(page.getByText("4 clienti", { exact: true })).toBeVisible();
    for (const r of imported) await expect(page.getByRole("link", { name: r.name, exact: true }).first()).toBeVisible();

    await page.getByRole("searchbox", { name: "Cerca clienti" }).fill("Zefiro");
    await expect(page.getByText("1 cliente trovati")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pasticceria Zefiro Unica" }).first()).toBeVisible();
    await expect(page).toHaveURL(/q=Zefiro/);

    await page.getByRole("searchbox", { name: "Cerca clienti" }).fill("xxxnessuno");
    await expect(page.getByText("Nessun cliente corrisponde ai filtri")).toBeVisible();
  });

  test("crea un cliente manuale e apre la scheda", async ({ page, api }) => {
    await createLead(api, { name: "Primo cliente" }); // evita l'empty state, che ha un altro pulsante
    await page.goto("/app/leads");
    await page.getByRole("button", { name: "Nuovo cliente" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome attività *").fill("Bar Centrale E2E");
    await dialog.getByLabel("Categoria").fill("Bar");
    await dialog.getByLabel("Città").fill("Bergamo");
    await dialog.getByLabel("Telefono").fill("035 123456");
    await dialog.getByLabel("Valore potenziale (€)").fill("5000");
    await dialog.getByRole("button", { name: "Crea cliente" }).click();

    await expect(page).toHaveURL(/\/app\/leads\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Bar Centrale E2E" })).toBeVisible();
    await expect(page.getByText("035 123456").first()).toBeVisible();

    await page.goto("/app/leads");
    await page.getByRole("link", { name: "Bar Centrale E2E" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Bar Centrale E2E" })).toBeVisible();
  });

  test("il nome è obbligatorio nella creazione", async ({ page, api }) => {
    await createLead(api, { name: "Primo cliente" });
    await page.goto("/app/leads");
    await page.getByRole("button", { name: "Nuovo cliente" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Crea cliente" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  });
});
