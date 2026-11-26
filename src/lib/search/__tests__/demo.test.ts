import { describe, expect, it } from "vitest";
import { demoGeocode, generateDemoResults } from "../demo";

describe("generatore demo", () => {
  const a = generateDemoResults({ query: "bar", location: "Milano", radiusKm: 3 });

  it("è deterministico", () => {
    const b = generateDemoResults({ query: "Bar", location: " milano ", radiusKm: 3 });
    expect(b).toEqual(a);
  });

  it("cambia con query o luogo diversi", () => {
    const c = generateDemoResults({ query: "ferramenta", location: "Milano", radiusKm: 3 });
    expect(c.results[0].sourceId).not.toBe(a.results[0].sourceId);
    expect(c.results[0].name).toMatch(/Ferramenta|Utensileria|Colori/);
  });

  it("produce attività plausibili entro il raggio, ordinate per distanza", () => {
    expect(a.results.length).toBeGreaterThanOrEqual(14);
    expect(a.results.length).toBeLessThanOrEqual(32);
    expect(a.center.label).toBe("Milano");
    const ids = new Set(a.results.map((r) => r.sourceId));
    expect(ids.size).toBe(a.results.length);
    for (const [i, r] of a.results.entries()) {
      expect(r.source).toBe("demo");
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.category).toBe("Bar");
      expect(r.city).toBe("Milano");
      expect(r.address).toMatch(/, 201\d\d Milano$/);
      expect(r.distanceKm).toBeLessThanOrEqual(3);
      if (i > 0) expect(r.distanceKm).toBeGreaterThanOrEqual(a.results[i - 1].distanceKm);
      if (r.phone) expect(r.phone).toMatch(/^(02|3\d\d) /);
      if (r.website) expect(r.website).toMatch(/^https:\/\/www\.[a-z0-9]+\.it$/);
    }
  });

  it("usa le coordinate se fornite", () => {
    const g = demoGeocode("45.07,7.69");
    expect(g.lat).toBe(45.07);
    expect(g.label).toContain("Torino");
  });

  it("riconosce un CAP", () => {
    expect(demoGeocode("40121").city.name).toBe("Bologna");
  });

  it("gestisce luoghi sconosciuti in modo stabile", () => {
    const x = demoGeocode("Borgo Inventato");
    expect(x).toEqual(demoGeocode("borgo inventato"));
    expect(x.label).toBe("Borgo Inventato");
  });
});
