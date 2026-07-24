import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ trackingCode: string }> }) {
  const { trackingCode } = await params;
  const rate = enforceRateLimit(`tracking:${clientIp(request)}`, 12, 60_000);
  if (!rate.allowed) return NextResponse.json({ code: "RATE_LIMITED", message: "Intentá nuevamente en unos minutos." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return apiError("SECONDARY_VERIFICATION_REQUIRED", "Ingresá el correo usado en la solicitud.", 422);
  try { const supabase = getSupabaseServerClient(); const { data, error } = await supabase.from("orders").select("tracking_code,status,created_at,scheduled_at,guest_email,service_types(name),order_status_history(new_status,created_at)").eq("tracking_code", trackingCode.toUpperCase()).maybeSingle<{ tracking_code: string; status: string; created_at: string; scheduled_at: string | null; guest_email: string | null; service_types: { name: string } | null; order_status_history: Array<{ new_status: string; created_at: string }> }>(); if (error || !data) return apiError("NOT_FOUND", "No encontramos ese pedido.", 404); if (data.guest_email?.toLowerCase() !== email) return apiError("NOT_FOUND", "No encontramos ese pedido.", 404); return NextResponse.json({ tracking_code: data.tracking_code, status: data.status, created_at: data.created_at, scheduled_at: data.scheduled_at, service_types: data.service_types, order_status_history: data.order_status_history }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return apiError("TRACKING_UNAVAILABLE", "No se pudo consultar el seguimiento.", 503); }
}
