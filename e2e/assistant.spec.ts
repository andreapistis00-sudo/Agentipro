import { test, expect, createLead } from "./helpers";

test.describe("Assistente", () => {
  test("invia un messaggio, risponde in demo, la conversazione resta dopo il reload", async ({ page, api }) => {
    await createLead(api, { name: "Bar Aurora", category: "Bar", city: "Milano", phone: "02 555555" });
    await page.goto("/app/assistant");
    await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
    const input = page.getByLabel("Scrivi un messaggio");
    await input.fill("Chi dovrei chiamare oggi?");
    await page.getByRole("button", { name: "Invia" }).click();

    // la risposta arriva e contiene il cliente del CRM
    await expect(page.getByText("Bar Aurora").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Invia" })).toBeVisible(); // streaming concluso
    await expect(page).toHaveURL(/[?&]c=/);

    // la conversazione appare nella lista (sidebar su desktop, drawer su mobile)
    const vw = page.viewportSize()!.width;
    if (vw < 1024) await page.getByRole("button", { name: "Apri conversazioni" }).click();
    const nav = page.getByRole("navigation", { name: "Conversazioni" });
    await expect(nav.getByText("Chi dovrei chiamare oggi")).toBeVisible();

    await page.reload();
    if (vw < 1024) await page.getByRole("button", { name: "Apri conversazioni" }).click();
    await expect(page.getByRole("navigation", { name: "Conversazioni" }).getByText("Chi dovrei chiamare oggi")).toBeVisible();
    await expect(page.getByText("Bar Aurora").first()).toBeVisible();
    await expect(page.getByText("Chi dovrei chiamare oggi?").first()).toBeVisible();
  });

  test("si apre con ?leadId= e usa il cliente come contesto", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Enoteca Verdi", category: "Enoteca", city: "Verona" });
    await page.goto(`/app/assistant?leadId=${lead.id}`);
    await expect(page.getByRole("heading", { name: /parliamo di Enoteca Verdi/ })).toBeVisible();
    await expect(page.getByPlaceholder("Chiedi qualcosa su Enoteca Verdi…")).toBeVisible();
    await page.getByLabel("Scrivi un messaggio").fill("Come lo approccio?");
    await page.getByRole("button", { name: "Invia" }).click();
    await expect(page.getByRole("button", { name: "Invia" })).toBeVisible({ timeout: 30_000 }); // streaming concluso
    await expect(page.getByRole("region", { name: "Chat" }).getByText("Enoteca Verdi").filter({ visible: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]c=/);
  });

  test("?leadId= di un altro utente non viene accettato come contesto", async ({ page, api, baseURL }) => {
    const { registerViaApi, uniqueUser } = await import("./helpers");
    const other = uniqueUser("oth");
    const otherSession = await registerViaApi(baseURL!, other);
    const { request } = await import("@playwright/test");
    const oapi = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: `ap_session=${otherSession}` } });
    const secret = await createLead(oapi, { name: "Segretissimo Altrui SRL" });
    await oapi.dispose();
    await page.goto(`/app/assistant?leadId=${secret.id}`);
    await expect(page.getByText("Segretissimo Altrui SRL")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /da dove partiamo oggi/ })).toBeVisible();
    void api;
  });
});
