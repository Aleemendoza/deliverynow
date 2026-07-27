import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest, context: { params: Promise<{ trackingCode: string }> }) {
  const rate = enforceRateLimit(`tracking-session:${clientIp(request)}`, 12, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Esperá un momento antes de volver a intentar.", 429);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Ingresá un correo válido.", 422);
  const { trackingCode } = await context.params;
  const database = getSupabaseServerClient();
  const { data: order } = await database.from("orders").select("id").eq("tracking_code", trackingCode.toUpperCase()).ilike("guest_email", parsed.data.email).maybeSingle<{ id: string }>();
  if (!order) return apiError("NOT_FOUND", "No encontramos ese pedido.", 404);
  const channel = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const { error } = await database.from("tracking_realtime_sessions").insert({ order_id: order.id, channel, expires_at: expiresAt });
  if (error) return apiError("TRACKING_UNAVAILABLE", "No pudimos activar las actualizaciones en tiempo real.", 503);
  return NextResponse.json({ channel: `tracking:${channel}`, expiresAt }, { headers: { "Cache-Control": "private, no-store" } });
}
