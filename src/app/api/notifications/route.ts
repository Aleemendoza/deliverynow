import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";

const markReadSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para ver notificaciones.", 401);
  const { data, error } = await supabase.from("notifications").select("id,title,body,type,created_at,read_at,order_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (error) return apiError("NOTIFICATIONS_UNAVAILABLE", "No se pudieron cargar las notificaciones.", 503);
  const notifications = data ?? [];
  return NextResponse.json({ notifications, unreadCount: notifications.filter((notification) => !notification.read_at).length });
}

export async function PATCH(request: Request) {
  const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La notificacion no es valida.", 422);

  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Inicia sesion para gestionar notificaciones.", 401);

  const readAt = new Date().toISOString();
  const database = getSupabaseServerClient();
  const { data, error } = await database.from("notifications")
    .update({ read_at: readAt })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("id")
    .maybeSingle();
  if (error) return apiError("NOTIFICATION_UPDATE_FAILED", "No se pudo actualizar la notificacion.", 503);
  if (!data) return apiError("NOT_FOUND", "No encontramos esa notificacion.", 404);
  return NextResponse.json({ id: data.id, readAt });
}
