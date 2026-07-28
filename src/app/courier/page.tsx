import { ClipboardList, PackageCheck, Radar, Wallet } from "lucide-react";
import { CourierAvailabilityProvider } from "@/components/courier/courier-availability-context";
import { CourierAvailabilityStatus } from "@/components/courier/courier-availability-status";
import { CourierAvailabilityToggle } from "@/components/courier/courier-availability-toggle";
import { CourierOrderCard, type CourierOrder } from "@/components/courier/courier-order-card";
import { NearbyOffers } from "@/components/courier/nearby-offers";
import { PushRegistration } from "@/components/notifications/push-registration";
import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const activeStatuses = ["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident"];
const operationalStatuses = [...activeStatuses, "delivered", "cancelled"] as const;

export default async function Courier() {
  const { supabase, profile } = await requireRole("courier");
  const database = getSupabaseServerClient();
  const { data: courier } = await database.from("couriers").select("id,is_online,availability_expires_at,transport_type").eq("profile_id", profile.id).maybeSingle<{ id: string; is_online: boolean; availability_expires_at: string | null; transport_type: string }>();
  const availableQuery = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmed");
  const activeQuery = courier ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("assigned_courier_id", courier.id).in("status", activeStatuses) : Promise.resolve({ count: 0 });
  const completedQuery = courier ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("assigned_courier_id", courier.id).eq("status", "delivered") : Promise.resolve({ count: 0 });
  const assignedOrdersQuery = courier
    ? supabase.from("orders").select("id,tracking_code,status,created_at,scheduled_at,completed_at,estimated_price,final_price,distance_meters,duration_seconds,payment_responsible,payment_method,notes,service_types(name),order_stops(type,contact_name,contact_phone_e164,instructions,arrived_at,completed_at,addresses(formatted_address,latitude,longitude,floor,apartment,reference)),order_status_history(new_status,created_at,reason)").eq("assigned_courier_id", courier.id).in("status", operationalStatuses).order("created_at", { ascending: false }).returns<CourierOrder[]>()
    : Promise.resolve({ data: [] as CourierOrder[] });
  const [{ count: available }, { count: active }, { count: completed }, { data: assignedOrders }] = await Promise.all([availableQuery, activeQuery, completedQuery, assignedOrdersQuery]);
  const orders = assignedOrders ?? [];
  const activeOrders = orders.filter((order) => activeStatuses.includes(order.status));
  const history = orders.filter((order) => ["delivered", "cancelled"].includes(order.status));
  const metrics = [{ label: "Disponibles", value: available ?? 0, Icon: Radar }, { label: "En curso", value: active ?? 0, Icon: ClipboardList }, { label: "Entregados", value: completed ?? 0, Icon: PackageCheck }, { label: "Movilidad", value: courier?.transport_type ?? "Sin configurar", Icon: Wallet }];

  const online = Boolean(courier?.is_online && courier.availability_expires_at && new Date(courier.availability_expires_at) > new Date());
  return <><SiteHeader/><CourierAvailabilityProvider initialOnline={online}><main className="mx-auto max-w-6xl px-4 py-6 sm:py-8"><header className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/15 to-zinc-900 p-4 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-brand">PANEL DE CADETE</p><h1 className="mt-2 break-words text-3xl font-bold">Hola, {profile.full_name?.split(" ")[0] || "cadete"}</h1><p className="mt-2 max-w-xl text-zinc-300">Administrá tu disponibilidad, pedidos asignados e historial de entregas desde un solo lugar.</p></div><CourierAvailabilityToggle/></div><CourierAvailabilityStatus hasActiveOrder={(active ?? 0) > 0}/></header>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">{metrics.map(({ label, value, Icon }) => <article className="rounded-xl bg-zinc-900 p-4" key={label}><Icon className="size-5 text-brand"/><p className="mt-3 text-sm text-zinc-400">{label}</p><p className="mt-1 text-xl font-bold capitalize">{value}</p></article>)}</section>
    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold">Pedidos disponibles cerca tuyo</h2><p className="mt-2 text-sm text-zinc-400">La cola se actualiza automáticamente mientras estés disponible.</p></div><PushRegistration/></div><div className="mt-5"><NearbyOffers/></div></section>
    <section className="mt-8"><div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><h2 className="text-xl font-bold">En curso</h2><span className="text-sm text-zinc-400">{activeOrders.length} pedidos</span></div><div className="grid gap-4">{activeOrders.length ? activeOrders.map((order) => <CourierOrderCard key={order.id} order={order}/>) : <Empty text="No tenés pedidos activos."/>}</div></section>
    <section className="mt-10"><div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><h2 className="text-xl font-bold">Finalizados</h2><span className="text-sm text-zinc-400">Últimos {history.length}</span></div><div className="grid gap-4">{history.length ? history.map((order) => <CourierOrderCard key={order.id} order={order} showHistory/>) : <Empty text="Todavía no hay pedidos finalizados en tu historial."/>}</div></section>
  </main></CourierAvailabilityProvider></>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">{text}</div>; }
