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
  const { data: profile } = await sessionClient.from("profiles").select("role,full_name,email").eq("id", user.id).maybeSingle<{ role: ProfileRole; full_name: string | null; email: string | null }>();
  if (profile?.role !== "customer") return apiError("FORBIDDEN", "Los pedidos deben solicitarse desde una cuenta de cliente.", 403);
  if (!profile.full_name?.trim()) return apiError("PROFILE_INCOMPLETE", "Completá tu nombre y apellido en Mi cuenta antes de solicitar un envío.", 409);

  const adminClient = getSupabaseServerClient();
  const { data: customer } = await adminClient.from("customers").select("id").eq("profile_id", user.id).maybeSingle<{ id: string }>();
  if (!customer) return apiError("CUSTOMER_PROFILE_MISSING", "Tu cuenta de cliente todavía no está lista. Cerrá sesión, ingresá nuevamente e intentá otra vez.", 409);

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Revisá los datos obligatorios del pedido.", 422);
  try {
    const accountOrder = { ...parsed.data, senderName: profile.full_name.trim(), senderEmail: profile.email ?? user.email ?? parsed.data.senderEmail };
    const order = await createOrder(accountOrder, customer.id);
    if (!order.duplicate && order.estimate) await sendOrderReceivedEmail({ recipient: accountOrder.senderEmail, trackingCode: order.trackingCode, total: order.estimate.price.total, pickup: accountOrder.pickup.formattedAddress, delivery: accountOrder.delivery.formattedAddress, pin: order.pin });
    return NextResponse.json({ trackingCode: order.trackingCode, status: order.status, duplicate: order.duplicate }, { status: order.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError("ORDER_CREATE_FAILED", error instanceof Error ? error.message : "No se pudo registrar el pedido.", 503);
  }
}
