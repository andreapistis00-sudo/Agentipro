import { test, expect, createLead, registerViaApi, uniqueUser } from "./helpers";
import { request as pwRequest } from "@playwright/test";

test("un utente non accede ai dati di un altro", async ({ api, baseURL, page }) => {
  const a = await createLead(api, { name: "Lead Riservato di A", phone: "011 000111" });

  const userB = uniqueUser("b");
  const sessB = await registerViaApi(baseURL!, userB);
  const apiB = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { cookie: `ap_session=${sessB}` } });

  const get = await apiB.get(`/api/leads/${a.id}`);
  expect([403, 404]).toContain(get.status());
  const patch = await apiB.patch(`/api/leads/${a.id}`, { data: { name: "Hackerato" } });
  expect([403, 404]).toContain(patch.status());
  const del = await apiB.delete(`/api/leads/${a.id}`);
  expect([403, 404]).toContain(del.status());
  const act = await apiB.post(`/api/leads/${a.id}/activities`, { data: { type: "note", content: "intrusione" } });
  expect([403, 404]).toContain(act.status());
  const move = await apiB.post("/api/pipeline", { data: { leadId: a.id, stage: "won", index: 0 } });
  expect([403, 404]).toContain(move.status());
  const bulk = await apiB.patch("/api/leads", { data: { ids: [a.id], stage: "lost", lostReason: "x" } });
  const bulkDel = await apiB.delete("/api/leads", { data: { ids: [a.id] } });
  expect(bulkDel.ok() ? (await bulkDel.json()).deleted : 0).toBe(0);
  void bulk;

  const list = await (await apiB.get("/api/leads")).json();
  expect(list.total).toBe(0);
  expect(JSON.stringify(list)).not.toContain("Lead Riservato di A");
  const csv = await (await apiB.get("/api/leads/export")).text();
  expect(csv).not.toContain("Lead Riservato di A");

  // il lead di A è intatto
  const still = await (await api.get(`/api/leads/${a.id}`)).json();
  expect(still.lead.name).toBe("Lead Riservato di A");
  expect(still.lead.stage).toBe("new");
  expect(still.activities).toHaveLength(0);

  // UI: B non vede il lead di A (pagina 404) e la lista è vuota
  const ctxB = await page.context().browser()!.newContext({ baseURL });
  await ctxB.addCookies([{ name: "ap_session", value: sessB, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  const pB = await ctxB.newPage();
  const res = await pB.goto(`/app/leads/${a.id}`);
  expect(res?.status()).toBe(404);
  await pB.goto("/app/leads");
  await expect(pB.getByText("Lead Riservato di A")).toHaveCount(0);
  await expect(pB.getByText("Ancora nessun cliente")).toBeVisible();
  await ctxB.close();
  await apiB.dispose();
});

test("isolamento su attività, AI e conversazioni", async ({ api, baseURL }) => {
  const a = await createLead(api, { name: "Lead AI di A", category: "Bar" });
  const actRes = await api.post(`/api/leads/${a.id}/activities`, { data: { type: "note", content: "nota privata di A" } });
  expect(actRes.ok(), await actRes.text()).toBeTruthy();
  const act = (await actRes.json()).activity;
  const chat = await api.post("/api/ai/chat", { data: { message: "ciao, nota riservata" } });
  expect(chat.ok()).toBeTruthy();
  const convs = (await (await api.get("/api/conversations")).json()).conversations as { id: string }[];
  expect(convs.length).toBe(1);

  const sessB = await registerViaApi(baseURL!, uniqueUser("b2"));
  const apiB = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { cookie: `ap_session=${sessB}` } });

  expect([403, 404]).toContain((await apiB.patch(`/api/activities/${act.id}`, { data: { content: "hack" } })).status());
  expect([403, 404]).toContain((await apiB.delete(`/api/activities/${act.id}`)).status());
  expect([403, 404]).toContain((await apiB.get(`/api/conversations/${convs[0].id}`)).status());
  expect([403, 404]).toContain((await apiB.delete(`/api/conversations/${convs[0].id}`)).status());
  expect((await (await apiB.get("/api/conversations")).json()).conversations).toHaveLength(0);
  const score = await apiB.post("/api/ai/score", { data: { leadIds: [a.id] } });
  expect([403, 404]).toContain(score.status());
  const brief = await apiB.post("/api/ai/briefing", { data: { leadId: a.id } });
  expect([403, 404]).toContain(brief.status());
  const chatB = await apiB.post("/api/ai/chat", { data: { message: "ciao", conversationId: convs[0].id } });
  expect(chatB.status()).not.toBe(200);

  // i dati di A sono intatti
  const still = await (await api.get(`/api/leads/${a.id}`)).json();
  expect(still.activities.map((x: { content: string }) => x.content)).toEqual(["nota privata di A"]);
  expect(still.lead.score).toBeNull();
  await apiB.dispose();
});
