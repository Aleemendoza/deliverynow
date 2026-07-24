import { describe, expect, it } from "vitest";
import { calculatePrice } from "./calculate";

describe("calculatePrice", () => {
  it("respects included distance and minimum price", () => {
    expect(calculatePrice(2800, "document", { basePrice: 3500, includedKm: 3, pricePerExtraKm: 450, minimumPrice: 3500, serviceSurcharges: {} }).total).toBe(3500);
  });
  it("adds service and extra-distance charges", () => {
    expect(calculatePrice(8400, "package", { basePrice: 3500, includedKm: 3, pricePerExtraKm: 450, minimumPrice: 3500, serviceSurcharges: { package: 500 } }).total).toBe(6430);
  });
});
