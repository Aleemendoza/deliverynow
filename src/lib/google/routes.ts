import { calculatePrice, type PricingRule } from "@/lib/pricing/calculate";
import type { ServiceType } from "@/types/domain";

type Coordinates = { latitude: number; longitude: number };
type GoogleRoutesError = { error?: { message?: string; status?: string } };

export type RouteEstimate = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  price: ReturnType<typeof calculatePrice>;
};

function toGoogleLatLng({ latitude, longitude }: Coordinates) {
  return { latitude, longitude };
}

export async function calculateRouteEstimate(pickup: Coordinates, delivery: Coordinates, serviceType: ServiceType, pricing: PricingRule): Promise<RouteEstimate> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not configured");

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: toGoogleLatLng(pickup) } },
      destination: { location: { latLng: toGoogleLatLng(delivery) } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "es-AR",
      regionCode: "AR",
    }),
    cache: "no-store",
  });
  const payload = await response.json() as GoogleRoutesError & {
    routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ? `Google Routes: ${payload.error.message}` : "Google Routes could not calculate the route");
  }

  const route = payload.routes?.[0];
  if (!route?.distanceMeters || !route.duration || !route.polyline?.encodedPolyline) {
    throw new Error("Google Routes returned an invalid route");
  }

  const durationSeconds = Number.parseFloat(route.duration.replace("s", ""));
  if (!Number.isFinite(durationSeconds)) throw new Error("Google Routes returned an invalid duration");

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: Math.round(durationSeconds),
    encodedPolyline: route.polyline.encodedPolyline,
    price: calculatePrice(route.distanceMeters, serviceType, pricing),
  };
}
