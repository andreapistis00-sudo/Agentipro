import { describe, expect, it } from "vitest";
import { demoResearch } from "../demo";
import {
  ResearchOutputSchema, ResearchSchema, contactSuggestions, parseResearch, parseScoreReason, researchFromOutput, researchOf, researchToText,
  type ResearchOutput,
} from "../schemas";
import { makeLead } from "./fixtures";

const output: ResearchOutput = {
  summary: "  Bar storico   in centro. ",
  business: { type: "Bar caffetteria", offering: "Colazioni e aperitivi", openingHours: "", priceLevel: "", foundedOrSince: "1978", size: "", locations: ["Via Roma 1, Milano", " ", "Via Roma 1, Milano"] },
  people: [{ name: "Giulia Verdi", role: "titolare", source: "https://giornale.example/articolo" }, { name: " ", role: "", source: "" }],
  online: {
    website: "barcentrale.it", phone: "02 1234567", email: "INFO@barcentrale.it",
    socials: [{ platform: "Instagram", url: "https://instagram.com/barcentrale" }, { platform: "X", url: "javascript:alert(1)" }],
    googleRating: 4.63, reviewsCount: 320.4, otherListings: [{ name: "TripAdvisor", url: "", detail: "4,5/5" }],
  },
  reputation: { overall: "Apprezzato per la colazione.", positives: ["Cornetti", "Cornetti", ""], negatives: ["Attesa nel weekend"] },
  facts: [{ text: "Ristrutturato nel 2025", sourceUrl: "https://giornale.example/ristrutturazione" }, { text: "", sourceUrl: "" }],
  signals: [{ label: "Aperto 7 giorni su 7", detail: "Dalle 6:30 alle 21" }],
  unknowns: ["Numero di dipendenti"],
  confidence: "alta",
};
const sources = [
  { title: "Sito", url: "https://barcentrale.it" },
  { title: "Duplicato", url: "https://barcentrale.it" },
  { title: "Pericoloso", url: "javascript:alert(1)" },
  { title: "", url: "https://www.tripadvisor.it/x" },
];

describe("Scheda AI: schema e normalizzazione", () => {
  it("lo schema di output accetta una scheda completa", () => {
    expect(ResearchOutputSchema.safeParse(output).success).toBe(true);
  });

  it("converte l'output del modello: testi vuoti → null, URL ripuliti, duplicati rimossi", () => {
    const r = researchFromOutput(output, sources);
    expect(r.v).toBe(2);
    expect(r.summary).toBe("Bar storico in centro.");
    expect(r.business.openingHours).toBeNull();
    expect(r.business.foundedOrSince).toBe("1978");
    expect(r.business.locations).toEqual(["Via Roma 1, Milano"]);
    expect(r.people).toEqual([{ name: "Giulia Verdi", role: "titolare", source: "https://giornale.example/articolo" }]);
    expect(r.online.website).toBe("https://barcentrale.it");
    expect(r.online.email).toBe("info@barcentrale.it");
    expect(r.online.socials).toHaveLength(1);
    expect(r.online.googleRating).toBe(4.6);
    expect(r.online.reviewsCount).toBe(320);
    expect(r.online.otherListings[0]).toEqual({ name: "TripAdvisor", url: null, detail: "4,5/5" });
    expect(r.reputation.positives).toEqual(["Cornetti"]);
    expect(r.facts).toHaveLength(1);
    expect(r.sources.map((s) => s.url)).toEqual(["https://barcentrale.it", "https://www.tripadvisor.it/x"]);
    expect(r.sources[1].title).toBe("tripadvisor.it");
    expect(ResearchSchema.safeParse(r).success).toBe(true);
  });

  it("legge la scheda salvata e la riconosce come v2", () => {
    const r = researchFromOutput(output, sources);
    const p = parseResearch(JSON.stringify(r));
    expect(p?.kind).toBe("ok");
    expect(researchOf(JSON.stringify(r))?.summary).toBe("Bar storico in centro.");
  });

  it("retrocompatibilità: un briefing della versione precedente risulta 'legacy', mai un errore", () => {
    const old = { snapshot: "Bar", whyNow: "Ora", talkingPoints: [], likelyObjections: [], offerToPropose: "x", openingLine: "Buongiorno", questionsToAsk: [], nextStep: "y", sources: [] };
    expect(parseResearch(JSON.stringify(old))).toEqual({ kind: "legacy" });
    expect(parseResearch("{non json")).toEqual({ kind: "legacy" });
    expect(parseResearch(JSON.stringify({ v: 2, summary: "incompleta" }))).toEqual({ kind: "legacy" });
    expect(parseResearch(null)).toBeNull();
    expect(researchOf(JSON.stringify(old))).toBeNull();
  });

  it("esporta il testo completo per la copia", () => {
    const t = researchToText(researchFromOutput(output, sources), "Bar Centrale");
    expect(t).toContain("SCHEDA AI — Bar Centrale");
    expect(t).toContain("Giulia Verdi — titolare");
    expect(t).toContain("+ Cornetti");
    expect(t).toContain("− Attesa nel weekend");
    expect(t).toContain("DA VERIFICARE");
    expect(t).toContain("FONTI");
  });

  it("propone solo i recapiti che mancano nella scheda cliente", () => {
    const r = researchFromOutput(output, sources);
    expect(contactSuggestions(r, { phone: null, email: null, website: null, contactName: null })).toEqual({
      phone: "02 1234567", email: "info@barcentrale.it", website: "https://barcentrale.it", contactName: "Giulia Verdi", contactRole: "titolare",
    });
    expect(contactSuggestions(r, { phone: "1", email: "a@b.it", website: "x.it", contactName: "Mario" })).toEqual({});
  });
});

describe("Scheda AI demo", () => {
  it("rispetta lo schema e usa solo i dati del CRM, senza consigli", () => {
    const lead = makeLead({ contactName: "Giulia Verdi", contactRole: "Titolare", openingHours: "Mo-Su 06:30-21:00" });
    const r = demoResearch(lead, [{ type: "call", content: "Interessata alle capsule.", dueAt: null, done: false, createdAt: new Date("2026-11-20T10:00:00Z") }]);
    expect(ResearchSchema.safeParse(r).success).toBe(true);
    expect(parseResearch(JSON.stringify(r))?.kind).toBe("ok");
    expect(r.demo).toBe(true);
    expect(r.summary).toContain("Bar Centrale");
    expect(r.people[0].name).toBe("Giulia Verdi");
    expect(r.online.website).toBe("https://barcentrale.it");
    expect(r.signals.map((s) => s.label)).toEqual(expect.arrayContaining(["Valutazione molto alta", "Aperto 7 giorni su 7", "Ultimo contatto registrato"]));
    expect(r.unknowns.length).toBeGreaterThan(0);
    const text = JSON.stringify(r).toLowerCase();
    for (const banned of ["obiezion", "frase d'apertura", "proponi", "prossimo passo", "chiamalo"]) expect(text).not.toContain(banned);
  });

  it("è deterministica", () => {
    expect(demoResearch(makeLead())).toEqual(demoResearch(makeLead()));
  });
});

describe("parseScoreReason", () => {
  it("legge il JSON e tollera testo libero", () => {
    expect(parseScoreReason(JSON.stringify({ summary: "Ok", factors: [{ label: "A", impact: "+", detail: "b" }] }))?.factors).toHaveLength(1);
    expect(parseScoreReason("motivazione testuale")).toEqual({ summary: "motivazione testuale", factors: [] });
    expect(parseScoreReason(null)).toBeNull();
  });
});
