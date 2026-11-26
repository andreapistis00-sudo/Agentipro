import { describe, expect, it } from "vitest";
import { haversineKm, offsetPoint, parseLatLng, projectKm } from "../geo";

describe("distanze", () => {
  it("Milano–Roma ≈ 477 km", () => {
    expect(haversineKm({ lat: 45.4642, lng: 9.19 }, { lat: 41.9028, lng: 12.4964 })).toBeCloseTo(477, -1);
  });

  it("distanza nulla tra punti uguali", () => {
    expect(haversineKm({ lat: 45, lng: 9 }, { lat: 45, lng: 9 })).toBe(0);
  });

  it("offsetPoint e haversine sono coerenti", () => {
    const c = { lat: 45.07, lng: 7.68 };
    for (const bearing of [0, 1, 2.5, 4]) {
      expect(haversineKm(c, offsetPoint(c, 3, bearing))).toBeCloseTo(3, 1);
    }
  });

  it("projectKm: nord = y positivo, est = x positivo", () => {
    const c = { lat: 44.5, lng: 11.3 };
    const n = projectKm(c, offsetPoint(c, 2, 0));
    const e = projectKm(c, offsetPoint(c, 2, Math.PI / 2));
    expect(n.y).toBeCloseTo(2, 3);
    expect(e.x).toBeCloseTo(2, 3);
  });
});

describe("parseLatLng", () => {
  it("riconosce coordinate", () => {
    expect(parseLatLng("45.4642, 9.19")).toEqual({ lat: 45.4642, lng: 9.19 });
    expect(parseLatLng("-33.9,18.42")).toEqual({ lat: -33.9, lng: 18.42 });
  });
  it("rifiuta testo e valori fuori intervallo", () => {
    expect(parseLatLng("Milano")).toBeNull();
    expect(parseLatLng("20121")).toBeNull();
    expect(parseLatLng("95,10")).toBeNull();
  });
});
