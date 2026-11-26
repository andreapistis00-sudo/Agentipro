import { describe, expect, it } from "vitest";
import { demoBriefing } from "../demo";
import { BriefingOutputSchema, briefingToText, normalizeBriefing, parseBriefing, parseScoreReason } from "../schemas";
import { makeLead, seller } from "./fixtures";

const valid = {
  snapshot: "  Bar storico   in centro. ",
  whyNow: "Ha appena ristrutturato.",
  talkingPoints: ["Colazioni", " ", "Assistenza 24h"],
  likelyObjections: [{ objection: "Costa troppo", response: "Guardiamo il costo per tazzina." }, { objection: "", response: "x" }],
  offerToPropose: "Prova di due settimane.",
  openingLine: "Buongiorno!",
  questionsToAsk: ["Quante colazioni fate?"],
  nextStep: "Appuntamento giovedì.",
  sources: [
    { title: "Sito", url: "https://barcentrale.it" },
    { title: "Duplicato", url: "https://barcentrale.it" },
    { title: "Pericoloso", url: "javascript:alert(1)" },
    { title: "", url: "https://www.tripadvisor.it/x" },
  ],
};

describe("parseBriefing", () => {
  it("valida e normalizza un briefing salvato", () => {
    const b = parseBriefing(JSON.stringify(valid));
    expect(b).not.toBeNull();
    expect(b!.snapshot).toBe("Bar storico in centro.");
    expect(b!.talkingPoints).toEqual(["Colazioni", "Assistenza 24h"]);
    expect(b!.likelyObjections).toHaveLength(1);
    expect(b!.sources.map((s) => s.url)).toEqual(["https://barcentrale.it", "https://www.tripadvisor.it/x"]);
    expect(b!.sources[1].title).toBe("tripadvisor.it");
  });

  it("restituisce null per JSON assente, malformato o incompleto", () => {
    expect(parseBriefing(null)).toBeNull();
    expect(parseBriefing("{non json")).toBeNull();
    expect(parseBriefing(JSON.stringify({ snapshot: "solo questo" }))).toBeNull();
  });

  it("accetta briefing senza fonti", () => {
    const { sources: _s, ...noSources } = valid;
    void _s;
    expect(parseBriefing(JSON.stringify(noSources))?.sources).toEqual([]);
  });

  it("il briefing demo rispetta lo schema ed è personalizzato", () => {
    const lead = makeLead({ contactName: "Giulia Verdi" });
    const b = demoBriefing(lead, [{ type: "call", content: "Interessata alle capsule, richiamare dopo le feste.", dueAt: null, done: false, createdAt: new Date("2026-11-20T10:00:00Z") }], seller);
    expect(BriefingOutputSchema.safeParse(b).success).toBe(true);
    expect(parseBriefing(JSON.stringify(b))).not.toBeNull();
    expect(b.demo).toBe(true);
    expect(b.snapshot).toContain("Bar Centrale");
    expect(b.openingLine).toContain("Marco");
    expect(b.talkingPoints.join(" ")).toContain("Interessata alle capsule");
    expect(b.sources.some((s) => s.url.startsWith("https://barcentrale.it"))).toBe(true);
    expect(b.talkingPoints.length).toBeGreaterThanOrEqual(3);
    expect(b.likelyObjections.length).toBeGreaterThanOrEqual(2);
  });

  it("esporta il testo completo per la copia", () => {
    const b = normalizeBriefing({ ...valid, sources: valid.sources });
    const t = briefingToText(b, "Bar Centrale");
    expect(t).toContain("BRIEFING VISITA — Bar Centrale");
    expect(t).toContain("«Buongiorno!»");
    expect(t).toContain("FONTI");
  });
});

describe("parseScoreReason", () => {
  it("legge il JSON e tollera testo libero", () => {
    expect(parseScoreReason(JSON.stringify({ summary: "Ok", factors: [{ label: "A", impact: "+", detail: "b" }] }))?.factors).toHaveLength(1);
    expect(parseScoreReason("motivazione testuale")).toEqual({ summary: "motivazione testuale", factors: [] });
    expect(parseScoreReason(null)).toBeNull();
  });
});
