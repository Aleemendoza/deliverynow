import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

type QueueOrder = { id: string; tracking_code: string; created_at: string; scheduled_at: string | null; estimated_price: number | null; final_price: number | null; distance_meters: number | null; duration_seconds: number | null; service_types: { name: string } | null };

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver la cola de pedidos.", 401);

  const database = getSupabaseServerClient();
  const { data: courier } = await database.from("couriers").select("is_active,is_online,availability_expires_at").eq("profile_id", user.id).maybeSingle<{ is_active: boolean; is_online: boolean; availability_expires_at: string | null }>();
  if (!courier?.is_active || !courier.is_online || !courier.availability_expires_at || new Date(courier.availability_expires_at) <= new Date()) return apiError("COURIER_OFFLINE", "Activá tu disponibilidad para ver pedidos.", 409);

  const { data, error } = await database.from("orders").select("id,tracking_code,created_at,scheduled_at,estimated_price,final_price,distance_meters,duration_seconds,service_types(name)").eq("status", "confirmed").is("assigned_courier_id", null).order("scheduled_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: true }).limit(30).returns<QueueOrder[]>();
  if (error) return apiError("QUEUE_UNAVAILABLE", "No se pudo cargar la cola de pedidos.", 503);
  const offers = (data ?? []).map((order) => ({ id: order.id, trackingCode: order.tracking_code, createdAt: order.created_at, scheduledAt: order.scheduled_at, estimatedPrice: order.final_price ?? order.estimated_price, routeDistanceMeters: order.distance_meters, routeDurationSeconds: order.duration_seconds, serviceName: order.service_types?.name ?? "Envío" }));
  return NextResponse.json({ offers }, { headers: { "Cache-Control": "private, no-store" } });
}
