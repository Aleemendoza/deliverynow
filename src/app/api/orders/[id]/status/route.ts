import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";

const schema = z.object({ status: z.enum(["confirmed", "assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "delivered", "cancelled", "rejected", "incident"]), reason: z.string().trim().max(500).optional(), deliveryPin: z.string().regex(/^\d{6}$/).optional(), pickupConfirmed: z.boolean().optional() }).superRefine((value, context) => { if (value.status === "picked_up" && !value.pickupConfirmed) context.addIssue({ code: "custom", path: ["pickupConfirmed"], message: "Confirmá que retiraste el pedido antes de continuar." }); });

export async function POST(request: NextRequest, context: RouteContext<"/api/orders/[id]/status">) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "El cambio de estado no es válido.", 422);
  const sessionClient = await createSupabaseServerClient(request);
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para actualizar el pedido.", 401);
  const { data, error } = await sessionClient.rpc("transition_order_status", { order_id: id, target_status: parsed.data.status, reason_text: parsed.data.reason ?? null, delivery_pin: parsed.data.deliveryPin ?? null });
  if (error || !data) return apiError("STATUS_CHANGE_FAILED", "No fue posible actualizar este pedido.", error?.message === "FORBIDDEN" ? 403 : 422);
  return NextResponse.json({ status: parsed.data.status });
}
