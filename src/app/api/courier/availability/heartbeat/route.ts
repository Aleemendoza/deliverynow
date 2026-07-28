import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getCourierOperationalProfile, isCourierAvailable } from "@/lib/couriers/operational-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para renovar tu disponibilidad.", 401);
  const { data, error } = await supabase.rpc("renew_courier_availability");
  if (error || !data) return apiError("AVAILABILITY_RENEWAL_FAILED", "No pudimos renovar tu disponibilidad.", 409);
  const { data: persistedCourier, error: persistedCourierError } = await getCourierOperationalProfile(user.id);
  if (persistedCourierError || !isCourierAvailable(persistedCourier)) return apiError("AVAILABILITY_STATE_UNCONFIRMED", "No pudimos confirmar la renovación de tu disponibilidad.", 409);
  return NextResponse.json({ expiresAt: persistedCourier!.availability_expires_at });
}
