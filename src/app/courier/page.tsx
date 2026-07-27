import Link from "next/link";
import { ClipboardList, PackageCheck, Radar, Wallet } from "lucide-react";
import { CourierAvailabilityToggle } from "@/components/courier/courier-availability-toggle";
import { CourierPresence } from "@/components/courier/courier-presence";
import { CourierAvailabilityLease } from "@/components/courier/courier-availability-lease";
import { PushRegistration } from "@/components/notifications/push-registration";
import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const activeStatuses = ["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident"];

export default async function Courier() {
  const { supabase, profile } = await requireRole("courier");
  const { data: courier } = await supabase.from("couriers").select("id,is_online,transport_type").eq("profile_id", profile.id).maybeSingle<{ id: string; is_online: boolean; transport_type: string }>();
  const availableQuery = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmed");
  const activeQuery = courier ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("assigned_courier_id", courier.id).in("status", activeStatuses) : Promise.resolve({ count: 0 });
  const completedQuery = courier ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("assigned_courier_id", courier.id).eq("status", "delivered") : Promise.resolve({ count: 0 });
  const [{ count: available }, { count: active }, { count: completed }] = await Promise.all([availableQuery, activeQuery, completedQuery]);
  const metrics = [{ label: "Disponibles", value: available ?? 0, Icon: Radar }, { label: "En curso", value: active ?? 0, Icon: ClipboardList }, { label: "Entregados", value: completed ?? 0, Icon: PackageCheck }, { label: "Movilidad", value: courier?.transport_type ?? "Sin configurar", Icon: Wallet }];
  const online = courier?.is_online ?? false;
  return <><SiteHeader/><main className="mx-auto max-w-6xl px-4 py-6 sm:py-8"><header className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/15 to-zinc-900 p-4 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-brand">PANEL DE CADETE</p><h1 className="mt-2 break-words text-3xl font-bold">Hola, {profile.full_name?.split(" ")[0] || "cadete"}</h1><p className="mt-2 max-w-xl text-zinc-300">Administrá tu disponibilidad, pedidos asignados e historial de entregas desde un solo lugar.</p></div><CourierAvailabilityToggle initialOnline={online}/></div><CourierPresence online={online} hasActiveOrder={(active ?? 0) > 0}/><CourierAvailabilityLease online={online}/></header><section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">{metrics.map(({ label, value, Icon }) => <article className="rounded-xl bg-zinc-900 p-4" key={label}><Icon className="size-5 text-brand"/><p className="mt-3 text-sm text-zinc-400">{label}</p><p className="mt-1 text-xl font-bold capitalize">{value}</p></article>)}</section><section className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:p-6"><h2 className="text-xl font-bold">Centro de operaciones</h2><p className="mt-2 text-zinc-400">Consultá ofertas exclusivas y aceptalas antes de su vencimiento.</p><Link href="/courier/orders" className="mt-5 block rounded-lg bg-brand px-4 py-3 text-center text-sm font-bold text-brand-foreground sm:inline-block">Ver pedidos y ofertas</Link><PushRegistration/></section></main></>;
}
