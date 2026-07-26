import { NextRequest, NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/validation/order";
import { apiError } from "@/lib/http";
import { createOrder } from "@/features/orders/server";
import { sendOrderReceivedEmail } from "@/lib/notifications/email";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRole = "customer" | "courier" | "admin";

export async function POST(request: NextRequest) {
  const rate = enforceRateLimit(`orders:${clientIp(request)}`, 8, 60_000);
  if (!rate.allowed) return NextResponse.json({ code: "RATE_LIMITED", message: "Intentá nuevamente en unos minutos." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para solicitar un envío.", 401);
  const { data: profile } = await sessionClient.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: ProfileRole }>();
  if (profile?.role !== "customer") return apiError("FORBIDDEN", "Los pedidos deben solicitarse desde una cuenta de cliente.", 403);

  const adminClient = getSupabaseServerClient();
  const { data: customer } = await adminClient.from("customers").select("id").eq("profile_id", user.id).maybeSingle<{ id: string }>();
  if (!customer) return apiError("CUSTOMER_PROFILE_MISSING", "Tu cuenta de cliente todavía no está lista. Cerrá sesión, ingresá nuevamente e intentá otra vez.", 409);

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Revisá los datos obligatorios del pedido.", 422);
  try {
    const order = await createOrder(parsed.data, customer.id);
    if (!order.duplicate && order.estimate) await sendOrderReceivedEmail({ recipient: parsed.data.senderEmail, trackingCode: order.trackingCode, total: order.estimate.price.total, pickup: parsed.data.pickup.formattedAddress, delivery: parsed.data.delivery.formattedAddress, pin: order.pin });
    return NextResponse.json({ trackingCode: order.trackingCode, status: order.status, duplicate: order.duplicate }, { status: order.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError("ORDER_CREATE_FAILED", error instanceof Error ? error.message : "No se pudo registrar el pedido.", 503);
  }
}
