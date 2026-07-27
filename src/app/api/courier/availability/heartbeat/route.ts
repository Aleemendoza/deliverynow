import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para renovar tu disponibilidad.", 401);
  const { data, error } = await supabase.rpc("renew_courier_availability");
  if (error || !data) return apiError("AVAILABILITY_RENEWAL_FAILED", "No pudimos renovar tu disponibilidad.", 409);
  return NextResponse.json({ expiresAt: data });
}
