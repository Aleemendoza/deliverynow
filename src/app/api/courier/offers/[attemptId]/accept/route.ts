import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await context.params;
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Iniciá sesión para aceptar el pedido.", 401);
  const { data, error } = await supabase.rpc("accept_order_offer", { attempt_id_value: attemptId });
  if (error || !data) return apiError("OFFER_UNAVAILABLE", error?.message === "OFFER_EXPIRED" ? "La oferta venció; buscamos el siguiente cadete." : "La oferta ya no está disponible.", 409);
  return NextResponse.json({ orderId: (data as { id: string }).id, status: "assigned" });
}
