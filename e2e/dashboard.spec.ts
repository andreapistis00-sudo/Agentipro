import { test, expect, createLead } from "./helpers";

test.describe("Oggi", () => {
  test("senza clienti mostra l'invito a cominciare", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Trova i tuoi primi clienti" })).toBeVisible();
  });

  test("mostra KPI e follow-up in scadenza", async ({ page, api }) => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await createLead(api, { name: "Cliente In Ritardo", stage: "contacted", value: 3000, nextFollowUp: yesterday });
    await createLead(api, { name: "Cliente Trattativa Uno", stage: "negotiation", value: 7000 });
    await createLead(api, { name: "Cliente Vinto Uno", stage: "won", value: 2000 });
    await page.goto("/app");

    const kpi = page.getByRole("region", { name: "Indicatori" });
    await expect(kpi.getByText("Clienti totali")).toBeVisible();
    await expect(kpi.getByText("3 aperti".replace("3", "2"))).toBeVisible();
    await expect(kpi.getByText("In trattativa")).toBeVisible();
    await expect(kpi.getByText("Pipeline aperta")).toBeVisible();
    await expect(kpi.getByText("Conversione")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Da fare oggi" })).toBeVisible();
    await expect(page.getByText("Cliente In Ritardo").first()).toBeVisible();
    await expect(page.getByText(/1 in ritardo/)).toBeVisible();
  });
});
