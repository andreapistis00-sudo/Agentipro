import { describe, expect, it } from "vitest";
import { GOOGLE_FIELD_MASK, buildGoogleRequest, cleanLocation, parseGooglePlaces, type GooglePlace } from "../google";

const center = { lat: 41.9028, lng: 12.4964 };

const places: GooglePlace[] = [
  {
    id: "ChIJ_far",
    displayName: { text: "Ristorante Lontano" },
    location: { latitude: 42.2, longitude: 12.9 }, // ~45 km: fuori raggio
  },
  {
    id: "ChIJ_1",
    displayName: { text: "Trattoria da Enzo" },
    formattedAddress: "Via dei Vascellari, 29, 00153 Roma RM, Italia",
    location: { latitude: 41.8885, longitude: 12.4766 },
    nationalPhoneNumber: "06 581 8355",
    websiteUri: "https://www.daenzoal29.com/",
    rating: 4.6,
    userRatingCount: 12000,
    primaryTypeDisplayName: { text: "Ristorante" },
    regularOpeningHours: { weekdayDescriptions: ["lunedì: 12:30–15:00", "martedì: 12:30–15:00"] },
    addressComponents: [
      { longText: "00153", types: ["postal_code"] },
      { longText: "Roma", types: ["locality", "political"] },
    ],
  },
  { id: "ChIJ_noname", location: { latitude: 41.9, longitude: 12.5 } },
  { id: "ChIJ_2", displayName: { text: "Bar vicino" }, location: { latitude: 41.903, longitude: 12.4965 } },
];

describe("parseGooglePlaces", () => {
  const results = parseGooglePlaces(places, center, 10);

  it("scarta luoghi senza nome o fuori raggio e ordina per distanza", () => {
    expect(results.map((r) => r.sourceId)).toEqual(["ChIJ_2", "ChIJ_1"]);
  });

  it("mappa i campi", () => {
    expect(results[1]).toMatchObject({
      source: "google",
      name: "Trattoria da Enzo",
      category: "Ristorante",
      address: "Via dei Vascellari, 29, 00153 Roma RM",
      city: "Roma",
      phone: "06 581 8355",
      website: "https://www.daenzoal29.com/",
      rating: 4.6,
      reviewsCount: 12000,
      openingHours: "lunedì: 12:30–15:00; martedì: 12:30–15:00",
      email: null,
    });
    expect(results[0]).toMatchObject({ category: null, phone: null, city: null, rating: null });
  });
});

describe("buildGoogleRequest", () => {
  it("cerca solo la categoria dentro un riquadro attorno al centro, con paginazione", () => {
    const body = buildGoogleRequest({ query: "ristoranti", center, radiusKm: 10, pageToken: "abc" });
    expect(body).toMatchObject({ textQuery: "ristoranti", languageCode: "it", pageSize: 20, pageToken: "abc" });
    const r = body.locationRestriction.rectangle;
    expect(r.low.latitude).toBeCloseTo(41.9028 - 10 / 111.32, 4);
    expect(r.high.latitude).toBeCloseTo(41.9028 + 10 / 111.32, 4);
    expect(r.low.longitude).toBeLessThan(12.4964);
    expect(r.high.longitude).toBeGreaterThan(12.4964);
  });

  it("ripulisce i luoghi descrittivi per il geocoding", () => {
    expect(cleanLocation("Cagliari e provincia")).toBe("Cagliari");
    expect(cleanLocation("provincia di Bergamo")).toBe("Bergamo");
    expect(cleanLocation("Milano")).toBe("Milano");
  });

  it("chiede i campi necessari nel field mask", () => {
    for (const f of ["places.id", "places.displayName", "places.nationalPhoneNumber", "places.regularOpeningHours.weekdayDescriptions", "places.addressComponents", "nextPageToken"]) {
      expect(GOOGLE_FIELD_MASK).toContain(f);
    }
  });
});
