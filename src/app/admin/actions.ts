"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const money = z.coerce.number().finite().min(0).max(10_000_000);
const pricingSchema = z.object({
  basePrice: money,
  includedKm: z.coerce.number().finite().min(0).max(1000),
  pricePerExtraKm: money,
  minimumPrice: money,
});
const serviceSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().trim().min(2).max(80),
});
const assignmentSchema = z.object({
  orderId: z.string().uuid(),
  courierId: z.string().uuid(),
});
const serviceToggleSchema = z.object({ id: z.string().uuid(), active: z.enum(["true", "false"]) });

function notice(message: string, error = false): never {
  redirect(`/admin?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

async function adminContext() {
  const current = await requireRole("admin");
  return { actorId: current.profile.id, database: getSupabaseServerClient() };
}

export async function createPricingRule(formData: FormData) {
  const parsed = pricingSchema.safeParse({
    basePrice: formData.get("basePrice"),
    includedKm: formData.get("includedKm"),
    pricePerExtraKm: formData.get("pricePerExtraKm"),
    minimumPrice: formData.get("minimumPrice"),
  });
  if (!parsed.success) notice("Revisá los valores de la tarifa.", true);

  const { actorId, database } = await adminContext();
  const validFrom = new Date().toISOString();
  const { error: closeError } = await database.from("pricing_rules").update({ valid_to: validFrom }).is("valid_to", null).lte("valid_from", validFrom);
  if (closeError) notice("No pudimos cerrar la tarifa anterior.", true);

  const { data: rule, error } = await database.from("pricing_rules").insert({
    base_price: parsed.data.basePrice,
    included_km: parsed.data.includedKm,
    price_per_extra_km: parsed.data.pricePerExtraKm,
    minimum_price: parsed.data.minimumPrice,
    configuration: { currency: "ARS", version: Date.now() },
    valid_from: validFrom,
  }).select("id").single<{ id: string }>();
  if (error || !rule) notice("No pudimos guardar la tarifa.", true);

  await database.from("audit_logs").insert({ actor_id: actorId, action: "pricing_rule.created", entity_type: "pricing_rule", entity_id: rule.id, after_data: parsed.data });
  revalidatePath("/admin");
  notice("Tarifa vigente actualizada.");
}

export async function createServiceType(formData: FormData) {
  const parsed = serviceSchema.safeParse({ code: formData.get("code"), name: formData.get("name") });
  if (!parsed.success) notice("El código debe usar letras, números o guiones bajos; y el nombre tener al menos 2 caracteres.", true);

  const { actorId, database } = await adminContext();
  const { data: service, error } = await database.from("service_types").insert({ ...parsed.data, active: true }).select("id").single<{ id: string }>();
  if (error || !service) notice(error?.code === "23505" ? "Ya existe un servicio con ese código." : "No pudimos crear el servicio.", true);

  await database.from("audit_logs").insert({ actor_id: actorId, action: "service_type.created", entity_type: "service_type", entity_id: service.id, after_data: parsed.data });
  revalidatePath("/admin");
  notice("Servicio agregado.");
}

export async function setServiceTypeStatus(formData: FormData) {
  const parsed = serviceToggleSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) notice("No pudimos identificar el servicio.", true);

  const { actorId, database } = await adminContext();
  const active = parsed.data.active === "true";
  const { error } = await database.from("service_types").update({ active }).eq("id", parsed.data.id);
  if (error) notice("No pudimos actualizar el servicio.", true);

  await database.from("audit_logs").insert({ actor_id: actorId, action: "service_type.status_changed", entity_type: "service_type", entity_id: parsed.data.id, after_data: { active } });
  revalidatePath("/admin");
  notice(active ? "Servicio habilitado." : "Servicio pausado.");
}

export async function assignOrder(formData: FormData) {
  const parsed = assignmentSchema.safeParse({ orderId: formData.get("orderId"), courierId: formData.get("courierId") });
  if (!parsed.success) notice("Elegí un cadete válido.", true);

  const { actorId, database } = await adminContext();
  const [{ data: order }, { data: courier }] = await Promise.all([
    database.from("orders").select("id,status").eq("id", parsed.data.orderId).maybeSingle<{ id: string; status: string }>(),
    database.from("couriers").select("id,is_active").eq("id", parsed.data.courierId).maybeSingle<{ id: string; is_active: boolean }>(),
  ]);
  if (!order || order.status !== "confirmed") notice("Solo se pueden asignar pedidos confirmados.", true);
  if (!courier?.is_active) notice("El cadete elegido no está activo.", true);

  const { error: updateError } = await database.from("orders").update({ assigned_courier_id: courier.id, status: "assigned", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "confirmed");
  if (updateError) notice("No pudimos asignar el pedido.", true);
  const { error: assignmentError } = await database.from("order_assignments").insert({ order_id: order.id, courier_id: courier.id, assigned_by: actorId });
  if (assignmentError) notice("El pedido fue actualizado, pero no se pudo registrar la asignación. Revisalo antes de continuar.", true);
  await Promise.all([
    database.from("order_status_history").insert({ order_id: order.id, previous_status: "confirmed", new_status: "assigned", changed_by: actorId, reason: "Asignado desde administración" }),
    database.from("audit_logs").insert({ actor_id: actorId, action: "order.assigned", entity_type: "order", entity_id: order.id, after_data: { courierId: courier.id } }),
  ]);
  revalidatePath("/admin");
  notice("Pedido asignado al cadete.");
}
