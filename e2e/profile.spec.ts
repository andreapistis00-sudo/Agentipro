import { test, expect } from "./helpers";

test("il profilo si salva e persiste dopo il reload", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Il tuo profilo" })).toBeVisible();
  await page.getByLabel("Azienda o mandante").fill("Caffè Aurora S.r.l.");
  await page.getByLabel("Settore").fill("Forniture per bar");
  await page.getByLabel("Territorio").fill("Milano e provincia");
  await page.getByLabel("Cosa vendi").fill("Caffè in grani e macchine in comodato");
  await page.getByLabel("Il tuo cliente ideale").fill("Bar con buon passaggio");
  await page.getByLabel("Tono dei messaggi").selectOption("Diretto e sintetico");
  await page.getByRole("button", { name: "Salva profilo" }).click();
  await expect(page.getByText("Profilo salvato")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Azienda o mandante")).toHaveValue("Caffè Aurora S.r.l.");
  await expect(page.getByLabel("Settore")).toHaveValue("Forniture per bar");
  await expect(page.getByLabel("Territorio")).toHaveValue("Milano e provincia");
  await expect(page.getByLabel("Cosa vendi")).toHaveValue("Caffè in grani e macchine in comodato");
  await expect(page.getByLabel("Il tuo cliente ideale")).toHaveValue("Bar con buon passaggio");
  await expect(page.getByLabel("Tono dei messaggi")).toHaveValue("Diretto e sintetico");
});
