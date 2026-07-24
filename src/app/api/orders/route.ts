import { NextRequest, NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/validation/order";
import { apiError } from "@/lib/http";
import { createOrder } from "@/features/orders/server";
import { sendOrderReceivedEmail } from "@/lib/notifications/email";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const rate = enforceRateLimit(`orders:${clientIp(request)}`, 8, 60_000);
  if (!rate.allowed) return NextResponse.json({ code: "RATE_LIMITED", message: "Intentá nuevamente en unos minutos." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Revisá los datos obligatorios del pedido.", 422);
  try {
    const order = await createOrder(parsed.data);
    if (!order.duplicate && order.estimate) await sendOrderReceivedEmail({ recipient: parsed.data.senderEmail, trackingCode: order.trackingCode, total: order.estimate.price.total, pickup: parsed.data.pickup.formattedAddress, delivery: parsed.data.delivery.formattedAddress, pin: order.pin });
    return NextResponse.json({ trackingCode: order.trackingCode, status: order.status, duplicate: order.duplicate }, { status: order.duplicate ? 200 : 201 });
  } catch (error) { return apiError("ORDER_CREATE_FAILED", error instanceof Error ? error.message : "No se pudo registrar el pedido.", 503); }
}
