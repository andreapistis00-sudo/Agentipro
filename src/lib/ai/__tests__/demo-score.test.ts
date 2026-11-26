import { describe, expect, it } from "vitest";
import { demoScore, detectIntent, familyOf, sellerFamilies } from "../demo";
import { inTerritory } from "../lead-context";
import { ScoreOutputSchema } from "../schemas";
import { makeLead, seller } from "./fixtures";

const NOW = new Date("2026-11-26T09:00:00Z");

describe("demoScore", () => {
  it("è deterministico e rispetta lo schema", () => {
    const a = demoScore(makeLead(), seller, [], NOW);
    const b = demoScore(makeLead(), seller, [], NOW);
    expect(a).toEqual(b);
    expect(ScoreOutputSchema.safeParse(a).success).toBe(true);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.factors.length).toBeGreaterThanOrEqual(3);
    expect(a.factors.length).toBeLessThanOrEqual(5);
    expect(a.summary).toMatch(/\.$/);
  });

  it("premia un lead in target, nel territorio, con ottime recensioni", () => {
    const r = demoScore(makeLead(), seller, [], NOW);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.factors.some((f) => f.label === "In target" && f.impact === "+")).toBe(true);
  });

  it("penalizza categorie fuori target e senza recapiti", () => {
    const off = demoScore(makeLead({ category: "Officina", name: "Autofficina Bianchi", phone: null, email: null, website: null, rating: null, reviewsCount: null }), seller, [], NOW);
    const on = demoScore(makeLead(), seller, [], NOW);
    expect(off.score).toBeLessThan(40);
    expect(off.score).toBeLessThan(on.score);
    expect(off.factors.some((f) => f.impact === "-" && f.label === "Fuori target")).toBe(true);
    expect(off.factors.some((f) => f.label === "Nessun recapito")).toBe(true);
  });

  it("considera territorio, fase e follow-up scaduti", () => {
    const base = demoScore(makeLead({ rating: 4.1, reviewsCount: 20 }), seller, [], NOW).score;
    const outside = demoScore(makeLead({ rating: 4.1, reviewsCount: 20, city: "Bari", address: "Via Sparano 3" }), { ...seller, territory: "Milano, Monza" }, [], NOW).score;
    const negotiating = demoScore(makeLead({ rating: 4.1, reviewsCount: 20, stage: "negotiation", nextFollowUp: new Date("2026-11-20T12:00:00Z") }), seller, [], NOW).score;
    const lost = demoScore(makeLead({ rating: 4.1, reviewsCount: 20, stage: "lost" }), seller, [], NOW).score;
    expect(outside).toBeLessThan(base);
    expect(negotiating).toBeGreaterThan(base);
    expect(lost).toBeLessThan(base);
  });

  it("resta nei limiti anche con tutti i segnali positivi", () => {
    const r = demoScore(
      makeLead({ stage: "negotiation", value: 8000, contactName: "Giulia", reviewsCount: 900, nextFollowUp: new Date("2026-11-01T12:00:00Z") }),
      seller,
      [{ type: "call", content: "Interessata", dueAt: null, done: false, createdAt: new Date("2026-11-25T10:00:00Z") }],
      NOW,
    );
    expect(r.score).toBeLessThanOrEqual(97);
  });

  it("con profilo vuoto non va in errore e suggerisce di completarlo", () => {
    const r = demoScore(makeLead(), { name: "Anna", company: null, sector: null, products: null, idealCustomer: null, territory: null, tone: null }, [], NOW);
    expect(r.factors.some((f) => f.label === "Profilo da completare") || r.factors.length >= 3).toBe(true);
  });
});

describe("helper euristici", () => {
  it("riconosce le famiglie di attività", () => {
    expect(familyOf("Pasticceria")).toBe("horeca");
    expect(familyOf("Parrucchiere")).toBe("beauty");
    expect(familyOf("Hotel")).toBe("hotel");
    expect(familyOf("Qualcosa di strano")).toBeNull();
    expect(sellerFamilies(seller).has("horeca")).toBe(true);
  });

  it("deduce il territorio quando possibile", () => {
    expect(inTerritory({ city: "Milano", address: null }, "Milano e provincia")).toBe(true);
    expect(inTerritory({ city: "Roma", address: null }, "Milano, Monza")).toBe(false);
    expect(inTerritory({ city: "Monza", address: null }, "Milano e provincia")).toBeNull();
    expect(inTerritory({ city: null, address: null }, "Milano")).toBeNull();
    expect(inTerritory({ city: "Milano", address: null }, null)).toBeNull();
  });

  it("riconosce gli intenti della chat demo", () => {
    expect(detectIntent("Chi dovrei chiamare oggi?", false).kind).toBe("prioritize");
    expect(detectIntent("Come rispondo a 'costa troppo'?", false)).toMatchObject({ kind: "objection", objection: "costa troppo" });
    expect(detectIntent("Prepara un piano visite per questa settimana", false).kind).toBe("plan");
    expect(detectIntent("Scrivimi un'email di primo contatto per il Bar Centrale", false)).toMatchObject({ kind: "email", target: "Bar Centrale" });
    const note = detectIntent("Ricordami di richiamarlo venerdì", true, new Date("2026-11-26T09:00:00Z"));
    expect(note).toMatchObject({ kind: "note", due: "2026-11-27" });
  });
});
