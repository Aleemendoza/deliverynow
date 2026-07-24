import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver notificaciones.", 401);
  const { data, error } = await supabase.from("notifications").select("id,title,body,type,created_at,read_at,order_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (error) return apiError("NOTIFICATIONS_UNAVAILABLE", "No se pudieron cargar las notificaciones.", 503);
  return NextResponse.json({ notifications: data ?? [] });
}
