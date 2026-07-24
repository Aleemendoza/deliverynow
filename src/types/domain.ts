export type UserRole = "customer" | "courier" | "admin";
export type OrderStatus = "draft" | "pending_confirmation" | "confirmed" | "assigned" | "heading_to_pickup" | "at_pickup" | "picked_up" | "heading_to_delivery" | "at_delivery" | "delivered" | "cancelled" | "rejected" | "incident";
export type ServiceType = "document" | "package" | "purchase" | "store_pickup" | "errand" | "other";

export type RouteAddress = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  street?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  floor?: string;
  apartment?: string;
  reference?: string;
};

export type PriceBreakdown = {
  basePrice: number;
  includedKm: number;
  distanceKm: number;
  extraKm: number;
  pricePerExtraKm: number;
  serviceSurcharge: number;
  total: number;
};
