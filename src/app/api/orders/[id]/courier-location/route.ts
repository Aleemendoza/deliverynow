import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Presence = { latitude: number; longitude: number; observed_at: string };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver la ubicación del pedido.", 401);

  const { data: order, error } = await supabase.from("orders").select("assigned_courier_id,status").eq("id", id).maybeSingle<{ assigned_courier_id: string | null; status: string }>();
  if (error || !order) return apiError("NOT_FOUND", "No encontramos ese pedido.", 404);
  if (!order.assigned_courier_id || !["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery"].includes(order.status)) {
    return NextResponse.json({ location: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const { data: presence } = await supabase.from("courier_presence").select("latitude,longitude,observed_at").eq("courier_id", order.assigned_courier_id).gte("observed_at", new Date(Date.now() - 60_000).toISOString()).maybeSingle<Presence>();
  return NextResponse.json({ location: presence ? { latitude: presence.latitude, longitude: presence.longitude, observedAt: presence.observed_at } : null }, { headers: { "Cache-Control": "private, no-store" } });
}
