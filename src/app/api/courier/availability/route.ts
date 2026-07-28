import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ isOnline: z.boolean() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La disponibilidad no es válida.", 422);
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para actualizar tu disponibilidad.", 401);

  // Older courier accounts may have had their profile role changed manually
  // without creating the required operational row. Repair that safe, known
  // inconsistency before invoking the transactional availability RPC.
  const database = getSupabaseServerClient();
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: "customer" | "courier" | "admin" }>();
  if (profile?.role !== "courier") return apiError("FORBIDDEN", "Tu cuenta no está habilitada como cadete.", 403);
  const { data: courier, error: courierError } = await database.from("couriers").select("id").eq("profile_id", user.id).maybeSingle<{ id: string }>();
  if (courierError) return apiError("COURIER_PROFILE_UNAVAILABLE", "No se pudo comprobar tu perfil operativo.", 503);
  if (!courier) {
    const { error: provisionError } = await database.from("couriers").upsert({ profile_id: user.id, transport_type: "moto" }, { onConflict: "profile_id" });
    if (provisionError) return apiError("COURIER_PROFILE_SETUP_FAILED", "No pudimos preparar tu perfil de cadete. Intentá nuevamente.", 503);
  }

  const { data, error } = await supabase.rpc("set_courier_availability", { online: parsed.data.isOnline });
  if (error || typeof data !== "boolean") {
    const setupError = error?.message === "COURIER_NOT_AVAILABLE" || error?.message === "COURIER_PROFILE_MISSING";
    return apiError("AVAILABILITY_CHANGE_FAILED", setupError ? "Tu perfil de cadete todavía no está activo. Contactá a administración." : "No fue posible actualizar tu disponibilidad.", setupError ? 409 : 403);
  }
  return NextResponse.json({ isOnline: data });
}
