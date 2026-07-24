import type { PriceBreakdown, ServiceType } from "@/types/domain";

export type PricingRule = { basePrice: number; includedKm: number; pricePerExtraKm: number; minimumPrice: number; serviceSurcharges: Partial<Record<ServiceType, number>> };
export const calculatePrice = (distanceMeters: number, serviceType: ServiceType, rule: PricingRule): PriceBreakdown => {
  const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
  const extraKm = Math.max(0, distanceKm - rule.includedKm);
  const serviceSurcharge = rule.serviceSurcharges[serviceType] ?? 0;
  const total = Math.max(rule.minimumPrice, Math.round(rule.basePrice + extraKm * rule.pricePerExtraKm + serviceSurcharge));
  return { basePrice: rule.basePrice, includedKm: rule.includedKm, distanceKm, extraKm, pricePerExtraKm: rule.pricePerExtraKm, serviceSurcharge, total };
};
