import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

const transportSchema = z.object({ transportType: z.enum(["bici", "moto"]) });

export async function POST(request: NextRequest) {
  const parsed = transportSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Elegí bicicleta o moto como medio de movilidad.", 422);
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para actualizar tu movilidad.", 401);
  const database = getSupabaseServerClient();
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (profile?.role !== "courier") return apiError("FORBIDDEN", "Tu cuenta no está habilitada como cadete.", 403);
  const { error } = await database.from("couriers").upsert({ profile_id: user.id, transport_type: parsed.data.transportType }, { onConflict: "profile_id" });
  if (error) return apiError("TRANSPORT_UPDATE_FAILED", "No pudimos actualizar tu movilidad. Intentá nuevamente.", 503);
  return NextResponse.json({ transportType: parsed.data.transportType });
}
