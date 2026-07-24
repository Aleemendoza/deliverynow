import { calculatePrice, type PricingRule } from "@/lib/pricing/calculate";
import type { ServiceType } from "@/types/domain";

type Coordinates = { latitude: number; longitude: number };
export type RouteEstimate = { distanceMeters: number; durationSeconds: number; price: ReturnType<typeof calculatePrice> };

export async function calculateRouteEstimate(pickup: Coordinates, delivery: Coordinates, serviceType: ServiceType, pricing: PricingRule): Promise<RouteEstimate> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_API_KEY no está configurada");
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration" }, body: JSON.stringify({ origin: { location: { latLng: pickup } }, destination: { location: { latLng: delivery } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }), cache: "no-store" });
  if (!response.ok) throw new Error("Google Routes no pudo calcular la ruta");
  const routes = await response.json() as { routes?: Array<{ distanceMeters?: number; duration?: string }> };
  const route = routes.routes?.[0];
  if (!route?.distanceMeters || !route.duration) throw new Error("Google Routes no devolvió una ruta válida");
  return { distanceMeters: route.distanceMeters, durationSeconds: Number.parseInt(route.duration.replace("s", ""), 10), price: calculatePrice(route.distanceMeters, serviceType, pricing) };
}
