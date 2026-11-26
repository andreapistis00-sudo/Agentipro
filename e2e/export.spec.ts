import { test, expect, createLead } from "./helpers";

test("l'export CSV risponde con text/csv e contiene i lead", async ({ api, page }) => {
  await createLead(api, { name: "Bar Export Uno", city: "Milano", phone: "02 111" });
  await createLead(api, { name: 'Trattoria "Due", Export', city: "Roma", stage: "contacted" });
  const res = await api.get("/api/leads/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toContain("attachment");
  const text = await res.text();
  expect(text).toContain("Nome");
  expect(text).toContain("Bar Export Uno");
  expect(text).toContain("Trattoria");
  expect(text).toContain("Contattato");

  // filtro: solo i contattati
  const filtered = await (await api.get("/api/leads/export?stage=contacted")).text();
  expect(filtered).toContain("Trattoria");
  expect(filtered).not.toContain("Bar Export Uno");

  // dalla UI: il link "Esporta CSV" scarica un file
  await page.goto("/app/leads");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Esporta CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^clienti-agentipro-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("export senza login è rifiutato", async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL });
  expect((await ctx.get("/api/leads/export")).status()).toBe(401);
  await ctx.dispose();
});

test("l'export CSV neutralizza le formule e preserva i telefoni con +", async ({ api }) => {
  await createLead(api, { name: "=HYPERLINK(\"http://evil\")", phone: "+39 02 1234567", notes: "riga1\nriga2" });
  const text = await (await api.get("/api/leads/export")).text();
  expect(text.startsWith("﻿")).toBe(true);
  expect(text).toContain("'=HYPERLINK");
  expect(text).not.toMatch(/(^|;|\r\n)"?=HYPERLINK/);
  expect(text).toContain(";+39 02 1234567;");
});
