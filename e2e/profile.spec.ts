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

test("criteri e pesi del punteggio: salvati e applicati subito ai clienti valutati", async ({ page, api }) => {
  const { createLead } = await import("./helpers");
  const lead = await createLead(api, { name: "Bar Pesi", category: "Bar", city: "Milano", phone: "02 1111111" });
  expect((await api.post("/api/ai/score", { data: { leadIds: [lead.id] } })).ok()).toBe(true);
  const before = (await (await api.get(`/api/leads/${lead.id}`)).json()).lead.score as number;

  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Come valuti un cliente" })).toBeVisible();
  await page.getByLabel("I tuoi criteri").fill("Conta di più se fa colazioni; meno se è una catena.");
  for (const d of ["Aderenza", "Dimensione", "Reputazione", "Presenza online", "Completezza dati"]) await page.getByLabel(d).fill("0");
  await page.getByLabel("Vicinanza").fill("5");
  await page.getByRole("button", { name: "Salva criteri e pesi" }).click();
  await expect(page.getByText(/Criteri salvati/)).toBeVisible();

  const after = (await (await api.get(`/api/leads/${lead.id}`)).json()).lead;
  const dims = JSON.parse(after.scoreBreakdown).dimensions;
  expect(after.score).toBe(dims.proximity.score); // solo la vicinanza conta
  expect(typeof before).toBe("number");

  await page.reload();
  await expect(page.getByLabel("I tuoi criteri")).toHaveValue("Conta di più se fa colazioni; meno se è una catena.");
  await expect(page.getByLabel("Vicinanza")).toHaveValue("5");
  await expect(page.getByLabel("Aderenza")).toHaveValue("0");
});
