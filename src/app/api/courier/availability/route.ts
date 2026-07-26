import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ isOnline: z.boolean() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La disponibilidad no es válida.", 422);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para actualizar tu disponibilidad.", 401);
  const { data, error } = await supabase.rpc("set_courier_availability", { online: parsed.data.isOnline });
  if (error || typeof data !== "boolean") return apiError("AVAILABILITY_CHANGE_FAILED", "No fue posible actualizar tu disponibilidad.", 403);
  return NextResponse.json({ isOnline: data });
}
