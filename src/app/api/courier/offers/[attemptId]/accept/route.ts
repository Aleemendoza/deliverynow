import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  const { attemptId: orderId } = await context.params;
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para aceptar el pedido.", 401);

  const { data, error } = await supabase.rpc("claim_available_order", { order_id_value: orderId });
  if (error || !data) {
    if (error?.message === "COURIER_NOT_AVAILABLE") return apiError("COURIER_OFFLINE", "Activá tu disponibilidad para tomar pedidos.", 409);
    if (error?.message === "COURIER_HAS_ACTIVE_ORDER") return apiError("COURIER_HAS_ACTIVE_ORDER", "Terminá o resolvé tu pedido activo antes de tomar otro.", 409);
    if (error?.message === "ORDER_NOT_AVAILABLE") return apiError("ORDER_UNAVAILABLE", "El pedido ya fue tomado por otro cadete.", 409);
    console.error("No se pudo reclamar el pedido de la cola.", { orderId, code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
    return apiError("ORDER_CLAIM_FAILED", "No pudimos tomar el pedido por un problema operativo. Intentá nuevamente.", 503);
  }
  return NextResponse.json({ orderId: (data as { id: string }).id, status: "assigned" });
}
