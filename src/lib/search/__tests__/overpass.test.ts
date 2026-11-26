import { describe, expect, it } from "vitest";
import { matchCategory } from "../categories";
import { buildOverpassQuery, parseOverpass, type OverpassElement } from "../overpass";

const center = { lat: 45.4642, lng: 9.19 };

const fixture: { elements: OverpassElement[] } = {
  elements: [
    {
      type: "node", id: 101, lat: 45.4652, lon: 9.1905,
      tags: {
        name: "Bar Duomo", amenity: "bar", "addr:street": "Via Torino", "addr:housenumber": "12",
        "addr:postcode": "20123", "addr:city": "Milano", phone: "+39 02 1234567; +39 333 1111111",
        website: "www.barduomo.it", opening_hours: "Mo-Su 07:00-20:00", email: "info@barduomo.it",
      },
    },
    { type: "way", id: 202, center: { lat: 45.47, lon: 9.2 }, tags: { name: "Caffè Brera", amenity: "cafe", "contact:phone": "02 7654321", "contact:website": "https://caffebrera.it" } },
    { type: "node", id: 303, lat: 45.466, lon: 9.19, tags: { amenity: "bar" } }, // senza nome: scartato
    { type: "relation", id: 404, tags: { name: "Senza coordinate", amenity: "bar" } }, // senza centro: scartato
    { type: "node", id: 101, lat: 45.4652, lon: 9.1905, tags: { name: "Bar Duomo", amenity: "bar" } }, // duplicato
  ],
};

describe("parseOverpass", () => {
  const results = parseOverpass(fixture, center, matchCategory("bar"));

  it("scarta elementi senza nome, senza coordinate e duplicati", () => {
    expect(results.map((r) => r.sourceId)).toEqual(["node/101", "way/202"]);
  });

  it("estrae indirizzo, contatti e orari", () => {
    const bar = results[0];
    expect(bar).toMatchObject({
      source: "osm",
      name: "Bar Duomo",
      category: "Bar",
      address: "Via Torino 12, 20123 Milano",
      city: "Milano",
      phone: "+39 02 1234567",
      email: "info@barduomo.it",
      website: "https://www.barduomo.it",
      openingHours: "Mo-Su 07:00-20:00",
      rating: null,
    });
    expect(bar.distanceKm).toBeGreaterThan(0.05);
    expect(bar.distanceKm).toBeLessThan(0.2);
  });

  it("usa il centroide delle way e i tag contact:*", () => {
    const way = results[1];
    expect(way).toMatchObject({ lat: 45.47, lng: 9.2, category: "Caffetteria", phone: "02 7654321", website: "https://caffebrera.it", address: null });
  });

  it("ordina per distanza", () => {
    expect(results[0].distanceKm).toBeLessThanOrEqual(results[1].distanceKm);
  });
});

describe("buildOverpassQuery", () => {
  it("usa i tag della categoria e il raggio in metri", () => {
    const q = buildOverpassQuery({ category: matchCategory("bar"), text: "bar", center, radiusKm: 2.5 });
    expect(q).toContain('nwr["amenity"~"^(bar|cafe)$"]["name"](around:2500,45.464200,9.190000);');
    expect(q).toContain("out center tags");
  });

  it("ripiega sulla ricerca per nome con regex case-insensitive ed escape", () => {
    const q = buildOverpassQuery({ category: null, text: 'Da "Mario" (2)', center, radiusKm: 1 });
    expect(q).toContain('["name"~"Da \\"Mario\\" \\\\(2\\\\)",i]["shop"]');
    expect(q).toContain('["amenity"]');
  });
});
