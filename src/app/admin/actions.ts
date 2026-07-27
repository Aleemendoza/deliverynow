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
const statusSchema = z.object({ orderId: z.string().uuid(), status: z.enum(["confirmed", "rejected", "cancelled", "incident"]) });
const userRoleSchema = z.object({ profileId: z.string().uuid(), role: z.enum(["customer", "courier"]) });

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

  const current = await requireRole("admin");
  const { error } = await current.supabase.rpc("assign_order_to_courier", {
    order_id_value: parsed.data.orderId,
    courier_id_value: parsed.data.courierId,
    reason_text: "Asignado desde administración",
  });
  if (error) notice("No pudimos asignar el pedido. Es posible que ya no esté disponible o que el cadete no esté activo.", true);
  revalidatePath("/admin");
  notice("Pedido asignado al cadete.");
}

export async function changeOrderStatus(formData: FormData) {
  const parsed = statusSchema.safeParse({ orderId: formData.get("orderId"), status: formData.get("status") });
  if (!parsed.success) notice("El cambio de estado no es válido.", true);

  const current = await requireRole("admin");
  const { error } = await current.supabase.rpc("transition_order_status", {
    order_id: parsed.data.orderId,
    target_status: parsed.data.status,
    reason_text: "Actualizado desde administración",
    delivery_pin: null,
  });
  if (error) notice("No pudimos actualizar el estado del pedido.", true);

  revalidatePath("/admin");
  notice(parsed.data.status === "confirmed" ? "Pedido confirmado y listo para asignar." : "Estado del pedido actualizado.");
}

export async function changeUserRole(formData: FormData) {
  const parsed = userRoleSchema.safeParse({ profileId: formData.get("profileId"), role: formData.get("role") });
  if (!parsed.success) redirect("/admin/users?error=No+pudimos+identificar+el+usuario+o+el+rol.");

  const { actorId, database } = await adminContext();
  if (parsed.data.profileId === actorId) redirect("/admin/users?error=No+pod%C3%A9s+modificar+tu+propio+rol+desde+este+panel.");

  const { data: profile, error: profileError } = await database.from("profiles").select("id,role").eq("id", parsed.data.profileId).maybeSingle<{ id: string; role: "customer" | "courier" | "admin" }>();
  if (profileError || !profile) redirect("/admin/users?error=El+usuario+ya+no+est%C3%A1+disponible.");
  if (profile.role === "admin") redirect("/admin/users?error=Los+administradores+se+gestionan+fuera+de+este+panel.");
  if (profile.role === parsed.data.role) redirect("/admin/users?notice=El+usuario+ya+ten%C3%ADa+ese+rol.");

  const { error: updateError } = await database.from("profiles").update({ role: parsed.data.role }).eq("id", parsed.data.profileId).eq("role", profile.role);
  if (updateError) redirect("/admin/users?error=No+pudimos+actualizar+el+rol+del+usuario.");

  const { error: courierError } = parsed.data.role === "courier"
    ? await database.from("couriers").update({ is_active: true }).eq("profile_id", parsed.data.profileId)
    : await database.from("couriers").update({ is_active: false, is_online: false }).eq("profile_id", parsed.data.profileId);
  if (courierError) redirect("/admin/users?error=El+rol+cambi%C3%B3%2C+pero+no+pudimos+actualizar+el+perfil+operativo+del+cadete.");

  await database.from("audit_logs").insert({ actor_id: actorId, action: "profile.role_changed", entity_type: "profile", entity_id: profile.id, before_data: { role: profile.role }, after_data: { role: parsed.data.role } });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(`/admin/users?notice=${encodeURIComponent(parsed.data.role === "courier" ? "Usuario promovido a cadete." : "Usuario asignado como cliente.")}`);
}
