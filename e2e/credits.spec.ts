import { test, expect, createLead, isMobile } from "./helpers";

test.describe("Crediti", () => {
  test("pagina crediti: saldo iniziale 50, costi, pacchetti disabilitati senza Stripe e movimento di benvenuto", async ({ page }) => {
    await page.goto("/app/credits");
    await expect(page.getByRole("heading", { name: "Crediti", exact: true })).toBeVisible();
    await expect(page.getByTestId("credits-page-balance")).toHaveText("50");
    await expect(page.getByText("Quanto costa ogni azione")).toBeVisible();
    await expect(page.getByText("Pagamenti non ancora attivi")).toBeVisible();
    await expect(page.getByText("Più scelto")).toBeVisible();
    for (const n of ["100", "500", "1500"]) {
      await expect(page.getByRole("button", { name: `Acquista ${Number(n).toLocaleString("it-IT")} crediti` })).toBeDisabled();
    }
    const history = page.getByRole("list", { name: "Storico movimenti" });
    await expect(history.getByText("Crediti di benvenuto")).toBeVisible();
    await expect(history.getByText("+50")).toBeVisible();
    await expect(page.getByRole("main").getByText("i crediti non vengono scalati")).toBeVisible();
  });

  test("il saldo è visibile nella navigazione e porta alla pagina crediti", async ({ page }) => {
    await page.goto("/app");
    if (isMobile(page)) {
      await page.getByRole("link", { name: "Crediti: 50" }).click();
    } else {
      await expect(page.getByTestId("credits-balance")).toHaveText(/50/);
      await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: /Crediti/ }).click();
    }
    await expect(page).toHaveURL(/\/app\/credits$/);
    await expect(page.getByTestId("credits-page-balance")).toHaveText("50");
  });

  test("in modalità demo l'AI non scala crediti", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Bar Crediti", category: "Bar", city: "Milano" });
    const res = await api.post("/api/ai/score", { data: { leadIds: [lead.id] } });
    expect(res.status()).toBe(200);
    expect((await res.json()).demo).toBe(true);
    const chat = await api.post("/api/ai/chat", { data: { message: "Chi dovrei chiamare oggi?" } });
    expect(chat.status()).toBe(200);
    await chat.text();
    await page.goto("/app/credits");
    await expect(page.getByTestId("credits-page-balance")).toHaveText("50");
    await expect(page.getByRole("list", { name: "Storico movimenti" }).getByRole("listitem")).toHaveCount(1);
  });

  test("checkout e webhook senza chiavi Stripe rispondono 503; annullamento mostra il messaggio", async ({ page, api }) => {
    const checkout = await api.post("/api/credits/checkout", { data: { packId: "pack-500" } });
    expect(checkout.status()).toBe(503);
    expect((await checkout.json()).error).toBe("Pagamenti non ancora attivi");
    const hook = await api.post("/api/stripe/webhook", { data: "{}", headers: { "stripe-signature": "t=1,v1=x" } });
    expect(hook.status()).toBe(503);
    await page.goto("/app/credits?canceled=1");
    await expect(page.getByText("Pagamento annullato")).toBeVisible();
  });

  test("il profilo mostra lo stato dei pagamenti e il saldo", async ({ page }) => {
    await page.goto("/app/settings");
    const row = page.getByRole("listitem").filter({ hasText: "Pagamenti (Stripe)" });
    await expect(row.getByText("Non configurata")).toBeVisible();
    await page.getByRole("link", { name: "Gestisci crediti" }).click();
    await expect(page).toHaveURL(/\/app\/credits$/);
  });
});
