import { describe, expect, it } from "vitest";
import { distanceInKm, isWithinServiceArea, VILLA_CONSTITUCION_CENTER } from "./service-area";

describe("service area", () => {
  it("accepts Villa Constitución center", () => expect(isWithinServiceArea(VILLA_CONSTITUCION_CENTER)).toBe(true));
  it("rejects locations outside the 20 km operational radius", () => {
    expect(distanceInKm(VILLA_CONSTITUCION_CENTER, { latitude: -33.6, longitude: -60.3297 })).toBeGreaterThan(20);
    expect(isWithinServiceArea({ latitude: -33.6, longitude: -60.3297 })).toBe(false);
  });
});
