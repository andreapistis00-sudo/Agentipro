import { test, expect, createLead, isMobile } from "./helpers";

test.describe("Pipeline", () => {
  test("mostra le colonne con i clienti", async ({ page, api }) => {
    await createLead(api, { name: "Cliente Nuovo", stage: "new" });
    await createLead(api, { name: "Cliente Trattativa", stage: "negotiation", value: 12000 });
    await page.goto("/app/pipeline");
    for (const [label, n] of [["Nuovo", 1], ["Contattato", 0], ["Qualificato", 0], ["Trattativa", 1], ["Vinto", 0], ["Perso", 0]] as const) {
      await expect(page.getByRole("region", { name: `${label}: ${n} clienti` })).toBeAttached();
    }
    await expect(page.getByRole("region", { name: "Nuovo: 1 clienti" }).getByText("Cliente Nuovo")).toBeVisible();
    await expect(page.getByRole("region", { name: "Trattativa: 1 clienti" }).getByText("Cliente Trattativa")).toBeVisible();
  });

  test("sposta un lead di colonna con la tastiera e persiste dopo il reload", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Cliente Da Spostare", stage: "new" });
    await page.goto("/app/pipeline");
    const card = page.getByRole("button", { name: "Cliente Da Spostare, Nuovo" });
    await card.focus();
    const live = page.locator("[aria-live]", { hasText: "Cliente Da Spostare" });
    await page.keyboard.press("Space");
    await expect(live.first()).toContainText("Cliente Da Spostare è sopra"); // drag iniziato
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("region", { name: "Contattato: 1 clienti" })).toBeAttached(); // anteprima nella colonna successiva
    await page.keyboard.press("Space");
    await expect(page.getByText("Spostato in Contattato")).toBeVisible();
    await expect(page.getByRole("region", { name: "Contattato: 1 clienti" }).getByText("Cliente Da Spostare")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Contattato: 1 clienti" }).getByText("Cliente Da Spostare")).toBeVisible();
    const { lead: l } = await (await page.request.get(`/api/leads/${lead.id}`)).json();
    expect(l.stage).toBe("contacted");
  });

  test("sposta un lead di colonna trascinando con il mouse", async ({ page, api }) => {
    test.skip(isMobile(page), "il drag con mouse è testato su desktop (touch usa un long-press)");
    const lead = await createLead(api, { name: "Cliente Drag", stage: "new" });
    await page.goto("/app/pipeline");
    const card = page.getByRole("button", { name: "Cliente Drag, Nuovo" });
    const target = page.getByRole("region", { name: "Qualificato: 0 clienti" });
    await card.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 5, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 25 });
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/pipeline") && r.request().method() === "POST");
    await page.mouse.up();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByRole("region", { name: "Qualificato: 1 clienti" }).getByText("Cliente Drag")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Qualificato: 1 clienti" }).getByText("Cliente Drag")).toBeVisible();
    const { lead: l } = await (await page.request.get(`/api/leads/${lead.id}`)).json();
    expect(l.stage).toBe("qualified");
  });
});
