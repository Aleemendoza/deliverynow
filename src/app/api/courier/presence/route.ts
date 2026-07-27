import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const presenceSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  observedAt: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = presenceSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La ubicación del cadete no es válida.", 422);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para actualizar tu ubicación.", 401);

  const { error } = await supabase.rpc("update_courier_presence", {
    latitude_value: parsed.data.latitude,
    longitude_value: parsed.data.longitude,
    observed_at_value: parsed.data.observedAt ?? new Date().toISOString(),
  });
  if (error) return apiError("COURIER_PRESENCE_FAILED", "No fue posible actualizar tu ubicación operativa.", error.message === "COURIER_NOT_AVAILABLE" ? 403 : 422);
  return NextResponse.json({ updated: true });
}
