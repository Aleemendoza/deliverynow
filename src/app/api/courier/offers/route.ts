import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { distanceInKm } from "@/lib/service-area";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ latitude: z.coerce.number().finite().min(-90).max(90), longitude: z.coerce.number().finite().min(-180).max(180) });
type OfferRow = { id: string; tracking_code: string; created_at: string; scheduled_at: string | null; estimated_price: number | null; final_price: number | null; distance_meters: number | null; duration_seconds: number | null; service_types: { name: string } | null; order_stops: Array<{ type: "pickup"; addresses: { latitude: number; longitude: number } | null }> };

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse({ latitude: request.nextUrl.searchParams.get("latitude"), longitude: request.nextUrl.searchParams.get("longitude") });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Compartí una ubicación válida para ordenar las ofertas.", 422);

  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver ofertas.", 401);

  const database = getSupabaseServerClient();
  const { data: courier } = await database.from("couriers").select("id,is_active,is_online").eq("profile_id", user.id).maybeSingle<{ id: string; is_active: boolean; is_online: boolean }>();
  if (!courier?.is_active || !courier.is_online) return apiError("COURIER_OFFLINE", "Activá tu disponibilidad para ver ofertas.", 409);

  const { data, error } = await database.from("orders").select("id,tracking_code,created_at,scheduled_at,estimated_price,final_price,distance_meters,duration_seconds,service_types(name),order_stops!inner(type,addresses(latitude,longitude))").eq("status", "confirmed").is("assigned_courier_id", null).eq("order_stops.type", "pickup").order("created_at", { ascending: false }).limit(50).returns<OfferRow[]>();
  if (error) return apiError("OFFERS_UNAVAILABLE", "No se pudieron cargar las ofertas.", 503);

  const origin = parsed.data;
  const offers = (data ?? []).flatMap((order) => {
    const pickup = order.order_stops[0]?.addresses;
    if (!pickup) return [];
    return [{ id: order.id, trackingCode: order.tracking_code, status: "confirmed" as const, createdAt: order.created_at, scheduledAt: order.scheduled_at, estimatedPrice: order.final_price ?? order.estimated_price, routeDistanceMeters: order.distance_meters, routeDurationSeconds: order.duration_seconds, serviceName: order.service_types?.name ?? "Envío", pickupDistanceKm: distanceInKm(origin, pickup) }];
  }).sort((left, right) => left.pickupDistanceKm - right.pickupDistanceKm);
  return NextResponse.json({ offers }, { headers: { "Cache-Control": "private, no-store" } });
}
