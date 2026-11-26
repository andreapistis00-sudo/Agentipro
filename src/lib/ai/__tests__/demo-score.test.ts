import { describe, expect, it } from "vitest";
import { demoScore, detectIntent, familyOf, sellerFamilies } from "../demo";
import { inTerritory } from "../lead-context";
import { ScoreOutputSchema } from "../schemas";
import { DEFAULT_WEIGHTS, DIMENSION_IDS, weightedScore } from "../scoring";
import { makeLead, seller } from "./fixtures";

const NOW = new Date("2026-11-26T09:00:00Z");
const total = (o: ReturnType<typeof demoScore>) => weightedScore(o.dimensions, DEFAULT_WEIGHTS);

describe("demoScore", () => {
  it("è deterministico, rispetta lo schema e restituisce sei sotto-punteggi motivati", () => {
    const a = demoScore(makeLead(), seller, [], NOW);
    expect(a).toEqual(demoScore(makeLead(), seller, [], NOW));
    expect(ScoreOutputSchema.safeParse(a).success).toBe(true);
    for (const id of DIMENSION_IDS) {
      expect(a.dimensions[id].score).toBeGreaterThanOrEqual(0);
      expect(a.dimensions[id].score).toBeLessThanOrEqual(100);
      expect(a.dimensions[id].reason.length).toBeGreaterThan(5);
    }
    expect(a.factors.length).toBeGreaterThanOrEqual(3);
    expect(a.factors.length).toBeLessThanOrEqual(5);
    expect(["alta", "media", "bassa"]).toContain(a.confidence);
    expect(a.summary).toMatch(/\.$/);
  });

  it("premia un lead in target, nel territorio, con ottime recensioni", () => {
    const r = demoScore(makeLead(), seller, [], NOW);
    expect(total(r)).toBeGreaterThanOrEqual(75);
    expect(r.dimensions.fit.score).toBeGreaterThanOrEqual(80);
    expect(r.dimensions.proximity.score).toBe(90);
    expect(r.factors.some((f) => f.label === "In target" && f.impact === "+")).toBe(true);
  });

  it("penalizza categorie fuori target e senza recapiti", () => {
    const off = demoScore(makeLead({ category: "Officina", name: "Autofficina Bianchi", phone: null, email: null, website: null, rating: null, reviewsCount: null }), seller, [], NOW);
    expect(total(off)).toBeLessThan(45);
    expect(total(off)).toBeLessThan(total(demoScore(makeLead(), seller, [], NOW)));
    expect(off.dimensions.fit.score).toBeLessThan(30);
    expect(off.dimensions.presence.score).toBeLessThan(20);
    expect(off.factors.some((f) => f.impact === "-" && f.label === "Fuori target")).toBe(true);
    expect(off.confidence).toBe("bassa");
  });

  it("vicinanza: fuori zona pesa meno del territorio, e i criteri dell'agente alzano l'aderenza", () => {
    const outside = demoScore(makeLead({ city: "Bari", address: "Via Sparano 3" }), { ...seller, territory: "Milano, Monza" }, [], NOW);
    expect(outside.dimensions.proximity.score).toBe(20);
    const base = demoScore(makeLead({ category: "Gelateria", name: "Gelateria Polo" }), seller, [], NOW).dimensions.fit.score;
    const crit = demoScore(makeLead({ category: "Gelateria", name: "Gelateria Polo" }), { ...seller, scoringCriteria: "Conta di più se fa gelato artigianale" }, [], NOW).dimensions.fit.score;
    expect(crit).toBeGreaterThan(base);
  });

  it("usa la Scheda AI come input quando c'è", () => {
    const lead = makeLead({ phone: null, email: null, website: null, rating: null, reviewsCount: null });
    const without = demoScore(lead, seller, [], NOW);
    const research = {
      v: 2, summary: "x", confidence: "alta", sources: [],
      business: { type: null, offering: null, openingHours: null, priceLevel: null, foundedOrSince: null, size: null, locations: [] },
      people: [], online: { website: "https://bar.it", phone: "02 1", email: null, socials: [], googleRating: 4.7, reviewsCount: 400, otherListings: [] },
      reputation: { overall: null, positives: [], negatives: [] }, facts: [], signals: [], unknowns: [],
    };
    const withR = demoScore({ ...lead, briefing: JSON.stringify(research) }, seller, [], NOW);
    expect(withR.dimensions.presence.score).toBeGreaterThan(without.dimensions.presence.score);
    expect(withR.dimensions.reputation.score).toBeGreaterThan(without.dimensions.reputation.score);
    expect(withR.dimensions.data.score).toBeGreaterThan(without.dimensions.data.score);
  });

  it("con profilo vuoto non va in errore e lo segnala", () => {
    const r = demoScore(makeLead(), { name: "Anna", company: null, sector: null, products: null, idealCustomer: null, territory: null, tone: null }, [], NOW);
    expect(r.dimensions.fit.score).toBe(50);
    expect(r.factors.some((f) => f.label === "Profilo da completare")).toBe(true);
  });

  it("i testi sono descrittivi: niente consigli commerciali", () => {
    const text = JSON.stringify(demoScore(makeLead({ stage: "negotiation" }), seller, [], NOW)).toLowerCase();
    for (const w of ["chiama", "richiam", "proponi", "visita", "contatta"]) expect(text).not.toContain(w);
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
    expect(detectIntent("Confronta i miei 5 clienti con punteggio più alto", false).kind).toBe("compare");
    expect(detectIntent("Quali clienti in Trattativa non sento da 2 settimane?", false)).toEqual({ kind: "stale", days: 14, stage: "negotiation" });
    expect(detectIntent("Chi non ho contattato da un mese?", false)).toEqual({ kind: "stale", days: 30, stage: null });
    expect(detectIntent("Cosa sai di Bar Centrale?", false)).toEqual({ kind: "lead_info", target: "Bar Centrale" });
    expect(detectIntent("Trova informazioni online su Pasticceria Rinaldi", false)).toEqual({ kind: "web", target: "Pasticceria Rinaldi" });
    expect(detectIntent("Cosa ho in scadenza questa settimana?", false).kind).toBe("followups");
    expect(detectIntent("Riassumi le note su questo cliente", true).kind).toBe("summary");
    expect(detectIntent("Scrivimi un'email per il Bar Centrale", false)).toMatchObject({ kind: "email", target: "Bar Centrale" });
    expect(detectIntent("Come lo approccio?", true).kind).toBe("lead_info");
    const note = detectIntent("Ricordami di richiamarlo venerdì", true, NOW);
    expect(note).toMatchObject({ kind: "note", due: "2026-11-27" });
  });
});
