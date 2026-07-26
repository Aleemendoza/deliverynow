import { parsePhoneNumberFromString } from "libphonenumber-js";
import { calculateRouteEstimate } from "@/lib/google/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderDraft } from "./schema";
import type { PricingRule } from "@/lib/pricing/calculate";
import { sendPushToProfile } from "@/lib/notifications/push";

type RuleRow = { base_price: number; included_km: number; price_per_extra_km: number; minimum_price: number; configuration: { serviceSurcharges?: Record<string, number> } | null };
const priceRule = (row: RuleRow): PricingRule => ({ basePrice: Number(row.base_price), includedKm: Number(row.included_km), pricePerExtraKm: Number(row.price_per_extra_km), minimumPrice: Number(row.minimum_price), serviceSurcharges: row.configuration?.serviceSurcharges ?? {} });

export async function estimateOrder(draft: Pick<OrderDraft, "pickup" | "delivery" | "serviceType" | "product">) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("pricing_rules").select("base_price,included_km,price_per_extra_km,minimum_price,configuration").lte("valid_from", new Date().toISOString()).or(`valid_to.is.null,valid_to.gt.${new Date().toISOString()}`).order("valid_from", { ascending: false }).limit(1).maybeSingle<RuleRow>();
  if (error || !data) throw new Error("No existe una tarifa vigente configurada");
  return calculateRouteEstimate(draft.pickup, draft.delivery, draft.serviceType, priceRule(data));
}

function normalizePhone(value: string) {
  const phone = parsePhoneNumberFromString(value, "AR");
  if (!phone?.isValid()) throw new Error("El teléfono no es válido");
  return phone.number;
}

function scheduledAt(draft: OrderDraft) {
  if (draft.deliverySchedule !== "scheduled" || !draft.scheduledDate || !draft.scheduledSlot) return null;
  const startTime = draft.scheduledSlot.slice(0, 5);
  return `${draft.scheduledDate}T${startTime}:00-03:00`;
}

export async function createOrder(draft: OrderDraft, customerId: string) {
  const supabase = getSupabaseServerClient();
  const estimate = await estimateOrder(draft);
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
  if (error || !data) throw new Error(error?.message === "SERVICE_UNAVAILABLE" ? "El servicio seleccionado no está disponible" : "No se pudo registrar el pedido");
  const result = data as { id?: string; trackingCode: string; status: string; pin?: string; duplicate: boolean };
  if (!result.duplicate && result.id) {
    const { error: customerError } = await supabase.from("orders").update({ customer_id: customerId }).eq("id", result.id).is("customer_id", null);
    if (customerError) throw new Error("No se pudo vincular el pedido a tu cuenta");
  }
  if (!result.duplicate && result.id) {
    const { data: couriers } = await supabase.from("couriers").select("profile_id").eq("is_active", true).eq("is_online", true).returns<Array<{ profile_id: string }>>();
    await Promise.all((couriers ?? []).map(async ({ profile_id }) => {
      await supabase.from("notifications").insert({ user_id: profile_id, order_id: result.id, channel: "in_app", type: "new_order", title: "Nuevo pedido disponible", body: `Pedido ${result.trackingCode} espera asignación`, status: "pending" });
      await sendPushToProfile(profile_id, "Nuevo pedido disponible", `Pedido ${result.trackingCode} espera asignación`, "/courier/orders");
    }));
  }
  return { ...result, estimate };
}
