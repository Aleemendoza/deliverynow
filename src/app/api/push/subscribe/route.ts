import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";

const schema = z.object({ endpoint: z.string().url().max(2048), keys: z.object({ p256dh: z.string().min(16), auth: z.string().min(8) }) });

export async function GET() {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para consultar las notificaciones.", 401);
  const database = getSupabaseServerClient();
  const { count, error } = await database.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
  if (error) return apiError("PUSH_SUBSCRIPTION_UNAVAILABLE", "No se pudo comprobar la suscripción.", 503);
  return NextResponse.json({ subscribed: (count ?? 0) > 0 });
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La suscripción push no es válida.", 422);
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para activar notificaciones.", 401);
  const adminClient = getSupabaseServerClient();
  const { error } = await adminClient.from("push_subscriptions").upsert({ profile_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, user_agent: request.headers.get("user-agent") }, { onConflict: "endpoint" });
  if (error) return apiError("PUSH_SUBSCRIPTION_FAILED", "No se pudo guardar la suscripción.", 503);
  return NextResponse.json({ subscribed: true });
}
