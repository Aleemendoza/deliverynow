import { parsePhoneNumberFromString } from "libphonenumber-js";
import { calculateRouteEstimate } from "@/lib/google/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderDraft } from "./schema";
import type { PricingRule } from "@/lib/pricing/calculate";
import { logOrderDebug } from "@/lib/observability/order-debug";

type RuleRow = { base_price: number; included_km: number; price_per_extra_km: number; minimum_price: number; configuration: { serviceSurcharges?: Record<string, number> } | null };
type DatabaseError = { code?: string; details?: string | null; hint?: string | null; message: string };

const priceRule = (row: RuleRow): PricingRule => ({ basePrice: Number(row.base_price), includedKm: Number(row.included_km), pricePerExtraKm: Number(row.price_per_extra_km), minimumPrice: Number(row.minimum_price), serviceSurcharges: row.configuration?.serviceSurcharges ?? {} });

function orderCreationError(error: DatabaseError | null) {
  if (!error) return new Error("No se pudo registrar el pedido. Referencia: ORDER_RPC_EMPTY");
  if (error.message === "SERVICE_UNAVAILABLE") return new Error("El servicio seleccionado no esta disponible");
  if (error.code === "42501") return new Error("El servidor no tiene permiso para crear pedidos. Aplica la migracion de permisos e intenta nuevamente. Referencia: 42501");
  if (error.code === "PGRST202") return new Error("Falta actualizar la funcion de creacion de pedidos en la base de datos. Referencia: ORDER_RPC_MISSING");
  if (error.code === "42883") return new Error("La funcion de pedidos tiene una dependencia de base de datos sin configurar. Referencia: ORDER_RPC_DEPENDENCY");
  if (error.code === "23503") return new Error("El servicio seleccionado ya no esta disponible. Elegi otro servicio e intenta nuevamente. Referencia: 23503");
  return new Error(`No se pudo registrar el pedido. Referencia: ${error.code ?? "ORDER_RPC_UNKNOWN"}`);
}

export async function estimateOrder(draft: Pick<OrderDraft, "pickup" | "delivery" | "serviceType" | "product">, requestId?: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("pricing_rules").select("base_price,included_km,price_per_extra_km,minimum_price,configuration").lte("valid_from", new Date().toISOString()).or(`valid_to.is.null,valid_to.gt.${new Date().toISOString()}`).order("valid_from", { ascending: false }).limit(1).maybeSingle<RuleRow>();
  logOrderDebug("order.pricing.responded", { requestId, hasPricingRule: Boolean(data), databaseCode: error?.code });
  if (error || !data) throw new Error("No existe una tarifa vigente configurada");
  return calculateRouteEstimate(draft.pickup, draft.delivery, draft.serviceType, priceRule(data), requestId);
}

function normalizePhone(value: string) {
  const phone = parsePhoneNumberFromString(value, "AR");
  if (!phone?.isValid()) throw new Error("El telefono no es valido");
  return phone.number;
}

function scheduledAt(draft: OrderDraft) {
  if (draft.deliverySchedule !== "scheduled" || !draft.scheduledDate || !draft.scheduledSlot) return null;
  const startTime = draft.scheduledSlot.slice(0, 5);
  return `${draft.scheduledDate}T${startTime}:00-03:00`;
}

export async function createOrder(draft: OrderDraft, customerId: string, customerProfileId: string, requestId?: string) {
  const supabase = getSupabaseServerClient();
  const { count: subscriptionCount, error: subscriptionError } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", customerProfileId);
  if (subscriptionError) throw new Error("No pudimos comprobar tus notificaciones. Intentá nuevamente.");
  if ((subscriptionCount ?? 0) === 0) throw new Error("Activá las notificaciones para poder confirmar un pedido.");
  logOrderDebug("order.creation.started", { requestId, serviceType: draft.serviceType, deliverySchedule: draft.deliverySchedule, urgent: draft.urgent });
  const estimate = await estimateOrder(draft, requestId);
  const payload = {
    ...draft,
    senderPhone: normalizePhone(draft.senderPhone),
    recipientPhone: normalizePhone(draft.recipientPhone),
    scheduledAt: scheduledAt(draft),
    distanceMeters: estimate.distanceMeters,
    durationSeconds: estimate.durationSeconds,
    total: estimate.price.total,
    priceSnapshot: estimate.price,
  };
  const { data, error } = await supabase.rpc("create_guest_order", { payload });
  logOrderDebug("order.rpc.responded", { requestId, hasData: Boolean(data), databaseCode: error?.code });
  if (error) console.error("No se pudo crear el pedido mediante create_guest_order.", { code: error.code, details: error.details, hint: error.hint, message: error.message });
  if (error || !data) throw orderCreationError(error);

  const result = data as { id?: string; trackingCode: string; status: string; pin?: string; duplicate: boolean };
  if (!result.duplicate && result.id) {
    const { error: customerError } = await supabase.rpc("link_customer_order_and_emit_created", { order_id_value: result.id, customer_id_value: customerId, actor_id_value: customerProfileId });
    logOrderDebug("order.customer_link.responded", { requestId, databaseCode: customerError?.code });
    if (customerError) throw new Error("No se pudo vincular el pedido a tu cuenta");
  }
  logOrderDebug("order.creation.completed", { requestId, duplicate: result.duplicate });
  return { ...result, estimate };
}
