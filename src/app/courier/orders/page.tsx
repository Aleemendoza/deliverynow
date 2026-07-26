import Link from "next/link";
import { CourierOrderCard, type CourierOrder } from "@/components/courier/courier-order-card";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const operationalStatuses = ["confirmed", "assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident", "delivered", "cancelled"] as const;

export default async function CourierOrders() {
  const { supabase } = await requireRole("courier");
  const { data } = await supabase.from("orders").select("id,tracking_code,status,created_at,scheduled_at,completed_at,estimated_price,final_price,distance_meters,duration_seconds,payment_responsible,payment_method,notes,service_types(name),order_stops(type,contact_name,contact_phone_e164,instructions,arrived_at,completed_at,addresses(formatted_address,latitude,longitude,floor,apartment,reference)),order_status_history(new_status,created_at,reason)").in("status", operationalStatuses).order("created_at", { ascending: false }).returns<CourierOrder[]>();
  const orders = data ?? [];
  const available = orders.filter((order) => order.status === "confirmed");
  const active = orders.filter((order) => ["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident"].includes(order.status));
  const history = orders.filter((order) => ["delivered", "cancelled"].includes(order.status));
  return <main className="mx-auto max-w-6xl px-4 py-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-brand">OPERACIÓN</p><h1 className="mt-2 text-3xl font-bold">Mis pedidos</h1><p className="mt-2 text-zinc-400">Toda la información necesaria para retirar, entregar y registrar cada hito.</p></div><Link href="/courier" className="text-sm font-bold text-brand">← Volver al panel</Link></header>
    <section className="mt-8"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-bold">Disponibles</h2><span className="text-sm text-zinc-400">{available.length} pedidos</span></div><div className="grid gap-4">{available.length ? available.map((order) => <CourierOrderCard key={order.id} order={order}/>) : <Empty text="No hay pedidos disponibles en este momento."/>}</div></section>
    <section className="mt-10"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-bold">En curso</h2><span className="text-sm text-zinc-400">{active.length} pedidos</span></div><div className="grid gap-4">{active.length ? active.map((order) => <CourierOrderCard key={order.id} order={order}/>) : <Empty text="No tenés pedidos activos."/>}</div></section>
    <section className="mt-10"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-bold">Finalizados</h2><span className="text-sm text-zinc-400">Últimos {history.length}</span></div><div className="grid gap-4">{history.length ? history.map((order) => <CourierOrderCard key={order.id} order={order} showHistory/>) : <Empty text="Todavía no hay pedidos finalizados en tu historial."/>}</div></section>
  </main>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">{text}</div>; }
