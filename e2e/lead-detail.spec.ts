import type { Page } from "@playwright/test";
import { test, expect, createLead } from "./helpers";

/** Clicca "Salva" nell'editor inline e attende la risposta del PATCH. */
async function saveField(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "PATCH" && /\/api\/leads\//.test(r.url()) && r.ok()),
    page.getByRole("button", { name: "Salva", exact: true }).click(),
  ]);
}

test.describe("Scheda cliente", () => {
  test("modifica telefono e note, persistono dopo il reload", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Ferramenta Rossi", category: "Ferramenta", city: "Como" });
    await page.goto(`/app/leads/${lead.id}`);

    await page.getByRole("button", { name: "Modifica telefono" }).click();
    await page.getByLabel("Telefono", { exact: true }).fill("031 998877");
    await saveField(page);
    await expect(page.getByRole("link", { name: "031 998877" })).toBeVisible();

    await page.getByRole("button", { name: "Modifica note" }).click();
    await page.getByLabel("Note", { exact: true }).fill("Chiedere del titolare, preferisce il mattino");
    await saveField(page);
    await expect(page.getByRole("textbox", { name: "Note", exact: true })).toHaveCount(0); // editor chiuso = salvataggio concluso
    await expect(page.getByText("Chiedere del titolare, preferisce il mattino")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("link", { name: "031 998877" })).toBeVisible();
    await expect(page.getByText("Chiedere del titolare, preferisce il mattino")).toBeVisible();
    const res = await page.request.get(`/api/leads/${lead.id}`);
    const { lead: l } = await res.json();
    expect(l.phone).toBe("031 998877");
    expect(l.notes).toBe("Chiedere del titolare, preferisce il mattino");
  });

  test("aggiunge un'attività e cambia fase", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Panificio Bianchi" });
    await page.goto(`/app/leads/${lead.id}`);

    await page.getByRole("radio", { name: "Chiamata" }).click();
    await page.getByLabel("Testo dell'attività").fill("Primo contatto telefonico, interessato al listino");
    await page.getByRole("button", { name: "Registra" }).click();
    await expect(page.getByText("Primo contatto telefonico, interessato al listino")).toBeVisible();

    await page.getByRole("combobox", { name: "Fase del cliente" }).selectOption("qualified");
    await expect(page.getByText("Fase aggiornata")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Primo contatto telefonico, interessato al listino")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Fase del cliente" })).toHaveValue("qualified");
  });

  test("'Valuta' calcola il punteggio AI (demo)", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Bar Stella", category: "Bar", city: "Milano", phone: "02 1234567" });
    await page.goto(`/app/leads/${lead.id}`);
    await expect(page.getByText("Non ancora valutato")).toBeVisible();
    await page.getByRole("button", { name: "Valuta", exact: true }).click();
    await expect(page.getByRole("img", { name: /^Punteggio \d+ su 100$/ })).toBeVisible();
    await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ricalcola" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("img", { name: /^Punteggio \d+ su 100$/ })).toBeVisible();
  });

  test("'Valuta' mostra le sei dimensioni e l'affidabilità (demo)", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Bar Luna", category: "Bar", city: "Milano", phone: "02 7654321", website: "barluna.it" });
    await page.goto(`/app/leads/${lead.id}`);
    await page.getByRole("button", { name: "Valuta", exact: true }).click();
    const bars = page.getByRole("list", { name: "Punteggio per dimensione" });
    await expect(bars).toBeVisible();
    for (const d of ["Aderenza", "Dimensione", "Reputazione", "Presenza online", "Vicinanza", "Completezza dati"]) {
      await expect(bars.getByRole("img", { name: new RegExp(`^${d}: \\d+ su 100$`) })).toBeVisible();
    }
    await expect(page.getByText(/^Affidabilità (alta|media|bassa)$/).first()).toBeVisible();
  });

  test("'Cerca informazioni' compila la Scheda AI (demo) e propone i recapiti trovati", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Osteria del Ponte", category: "Ristorante", city: "Bologna", contactName: "Luca Neri" });
    await page.goto(`/app/leads/${lead.id}`);
    await expect(page.getByRole("heading", { name: "Scheda AI" })).toBeVisible();
    await page.getByRole("button", { name: "Cerca informazioni" }).click();
    await expect(page.getByRole("button", { name: "Aggiorna" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Da verificare")).toBeVisible();
    await expect(page.getByText("Fonti", { exact: true })).toBeVisible();
    await expect(page.getByText("Luca Neri").first()).toBeVisible();
    // niente coaching nella scheda
    await expect(page.getByText(/frase d'apertura|obiezion|prossimo passo/i)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "Aggiorna" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copia" })).toBeVisible();
  });

  test("una scheda della versione precedente non rompe la pagina", async ({ page, api }) => {
    const lead = await createLead(api, { name: "Bar Vecchio" });
    const { db } = await import("./db");
    await db.lead.update({ where: { id: lead.id }, data: { briefing: JSON.stringify({ snapshot: "x", openingLine: "Buongiorno" }), briefingAt: new Date() } });
    await page.goto(`/app/leads/${lead.id}`);
    await expect(page.getByText("Scheda creata con la versione precedente")).toBeVisible();
    await page.getByRole("button", { name: "Aggiorna" }).click();
    await expect(page.getByRole("button", { name: "Copia" })).toBeVisible({ timeout: 30_000 });
  });
});
