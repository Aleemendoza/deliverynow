import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

type Attempt = { id: string; expires_at: string; orders: { id: string; tracking_code: string; created_at: string; scheduled_at: string | null; estimated_price: number | null; final_price: number | null; distance_meters: number | null; duration_seconds: number | null; service_types: { name: string } | null } | null };

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver ofertas.", 401);
  const database = getSupabaseServerClient();
  const { data: courier } = await database.from("couriers").select("id,is_active,is_online,availability_expires_at").eq("profile_id", user.id).maybeSingle<{ id: string; is_active: boolean; is_online: boolean; availability_expires_at: string | null }>();
  if (!courier?.is_active || !courier.is_online || !courier.availability_expires_at || new Date(courier.availability_expires_at) <= new Date()) return apiError("COURIER_OFFLINE", "Reconectate para recibir pedidos.", 409);
  const { data, error } = await database.from("order_offer_attempts").select("id,expires_at,order_offer_rounds!inner(order_id,orders!inner(id,tracking_code,created_at,scheduled_at,estimated_price,final_price,distance_meters,duration_seconds,service_types(name)))").eq("courier_id", courier.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("offered_at", { ascending: false }).limit(1);
  if (error) return apiError("OFFERS_UNAVAILABLE", "No se pudieron cargar las ofertas.", 503);
  const offers = (data ?? []).flatMap((row) => {
    const typed = row as unknown as { id: string; expires_at: string; order_offer_rounds: { order_id: string; orders: Attempt["orders"] } };
    const order = typed.order_offer_rounds.orders;
    return order ? [{ id: order.id, attemptId: typed.id, expiresAt: typed.expires_at, trackingCode: order.tracking_code, status: "confirmed" as const, createdAt: order.created_at, scheduledAt: order.scheduled_at, estimatedPrice: order.final_price ?? order.estimated_price, routeDistanceMeters: order.distance_meters, routeDurationSeconds: order.duration_seconds, serviceName: order.service_types?.name ?? "Envío", pickupDistanceKm: 0 }] : [];
  });
  return NextResponse.json({ offers }, { headers: { "Cache-Control": "private, no-store" } });
}
