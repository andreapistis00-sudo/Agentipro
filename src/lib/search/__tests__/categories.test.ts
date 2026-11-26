import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryLabelFromTags, matchCategory, normalize } from "../categories";

describe("mappatura categorie", () => {
  it.each([
    ["bar", "bar"],
    ["Bar", "bar"],
    ["ristoranti", "restaurant"],
    ["Trattorie", "restaurant"],
    ["parrucchieri", "hairdresser"],
    ["Studi dentistici", "dentist"],
    ["studio dentistico", "dentist"],
    ["dentisti", "dentist"],
    ["ferramenta", "hardware"],
    ["Farmacie", "pharmacy"],
    ["pizzerie", "pizzeria"],
    ["caffè", "bar"],
    ["officine meccaniche", "car_repair"],
    ["agenzie immobiliari", "real_estate"],
    ["negozi di abbigliamento", "clothes"],
    ["commercialisti", "accountant"],
  ])("%s → %s", (q, id) => {
    expect(matchCategory(q)?.id).toBe(id);
  });

  it("restituisce null per parole non mappate", () => {
    expect(matchCategory("Esselunga")).toBeNull();
    expect(matchCategory("   ")).toBeNull();
  });

  it("ha almeno 40 categorie, ognuna con tag OSM", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(40);
    for (const c of CATEGORIES) expect(c.tags.length).toBeGreaterThan(0);
  });

  it("normalizza accenti e punteggiatura", () => {
    expect(normalize("  Caffè   Città! ")).toBe("caffe citta");
  });

  it("produce etichette italiane dai tag", () => {
    expect(categoryLabelFromTags({ amenity: "dentist" })).toBe("Studio dentistico");
    expect(categoryLabelFromTags({ shop: "hairdresser" })).toBe("Parrucchiere");
    expect(categoryLabelFromTags({ shop: "hairdresser" }, matchCategory("barbieri"))).toBe("Barbiere");
    expect(categoryLabelFromTags({ amenity: "restaurant", cuisine: "pizza" }, matchCategory("pizzerie"))).toBe("Pizzeria");
    expect(categoryLabelFromTags({ shop: "fishing" })).toBe("Negozio · fishing");
    expect(categoryLabelFromTags({})).toBeNull();
  });
});
