import { NextRequest, NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/validation/order";
import { apiError } from "@/lib/http";
import { createOrder } from "@/features/orders/server";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { logOrderDebug } from "@/lib/observability/order-debug";

type ProfileRole = "customer" | "courier" | "admin";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logOrderDebug("order.request.received", { requestId });

  const rate = enforceRateLimit(`orders:${clientIp(request)}`, 8, 60_000);
  if (!rate.allowed) {
    logOrderDebug("order.request.rejected", { requestId, reason: "rate_limited" });
    return NextResponse.json({ code: "RATE_LIMITED", message: "Intenta nuevamente en unos minutos." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    logOrderDebug("order.request.rejected", { requestId, reason: "unauthenticated" });
    return apiError("UNAUTHORIZED", "Inicia sesion para solicitar un envio.", 401);
  }

  const { data: profile } = await sessionClient.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle<{ role: ProfileRole; full_name: string | null }>();
  if (profile?.role !== "customer") {
    logOrderDebug("order.request.rejected", { requestId, reason: "invalid_role" });
    return apiError("FORBIDDEN", "Los pedidos deben solicitarse desde una cuenta de cliente.", 403);
  }
  if (!profile.full_name?.trim()) {
    logOrderDebug("order.request.rejected", { requestId, reason: "incomplete_profile" });
    return apiError("PROFILE_INCOMPLETE", "Completa tu nombre y apellido en Mi cuenta antes de solicitar un envio.", 409);
  }

  const adminClient = getSupabaseServerClient();
  const { data: customer } = await adminClient.from("customers").select("id").eq("profile_id", user.id).maybeSingle<{ id: string }>();
  if (!customer) {
    logOrderDebug("order.request.rejected", { requestId, reason: "missing_customer" });
    return apiError("CUSTOMER_PROFILE_MISSING", "Tu cuenta de cliente todavia no esta lista. Cerra sesion, ingresa nuevamente e intenta otra vez.", 409);
  }

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    logOrderDebug("order.request.rejected", { requestId, reason: "validation", issueCount: parsed.error.issues.length });
    return apiError("VALIDATION_ERROR", "Revisa los datos obligatorios del pedido.", 422);
  }

  try {
    const accountOrder = { ...parsed.data, senderName: profile.full_name.trim() };
    const order = await createOrder(accountOrder, customer.id, user.id, requestId);
    // Notifications are asynchronous through the outbox. The response never
    // discloses addresses, contacts, or delivery outcome.
    logOrderDebug("order.request.completed", { requestId, status: order.duplicate ? 200 : 201, duplicate: order.duplicate });
    return NextResponse.json({ trackingCode: order.trackingCode, status: order.status, duplicate: order.duplicate }, { status: order.duplicate ? 200 : 201 });
  } catch (error) {
    logOrderDebug("order.request.failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError("ORDER_CREATE_FAILED", error instanceof Error ? error.message : "No se pudo registrar el pedido.", 503);
  }
}
