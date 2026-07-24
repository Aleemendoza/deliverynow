import { NextRequest, NextResponse } from "next/server";
import { estimateSchema } from "@/lib/validation/order";
import { apiError } from "@/lib/http";
import { estimateOrder } from "@/features/orders/server";

export async function POST(request: NextRequest) {
  const parsed = estimateSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Revisá retiro, entrega y tipo de servicio.", 422);
  try { const estimate = await estimateOrder(parsed.data); return NextResponse.json({ distanceMeters: estimate.distanceMeters, durationSeconds: estimate.durationSeconds, price: estimate.price, priceStatus: "confirmed" }); }
  catch (error) { return apiError("ESTIMATE_UNAVAILABLE", error instanceof Error ? error.message : "No se pudo calcular la ruta.", 503); }
}
