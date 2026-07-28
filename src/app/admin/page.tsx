import { createPricingRule, createServiceType, setServiceTypeStatus } from "./actions";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

type SearchParams = Promise<{ notice?: string; error?: string }>;
type PricingRule = { base_price: number; included_km: number; price_per_extra_km: number; minimum_price: number };
type Service = { id: string; code: string; name: string; active: boolean };
type Order = { id: string; tracking_code: string; status: string; created_at: string; estimated_price: number | null; service_types: Array<{ name: string }> | null };
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("admin");
  const database = getSupabaseServerClient(); const now = new Date().toISOString();
  const [params, pricingResult, servicesResult, ordersResult, queueResult, activeResult] = await Promise.all([
    searchParams,
    database.from("pricing_rules").select("base_price,included_km,price_per_extra_km,minimum_price").lte("valid_from", now).or(`valid_to.is.null,valid_to.gt.${now}`).order("valid_from", { ascending: false }).limit(1).maybeSingle<PricingRule>(),
    database.from("service_types").select("id,code,name,active").order("name").returns<Service[]>(),
    database.from("orders").select("id,tracking_code,status,created_at,estimated_price,service_types(name)").order("created_at", { ascending: false }).limit(20).returns<Order[]>(),
    database.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmed").is("assigned_courier_id", null),
    database.from("orders").select("id", { count: "exact", head: true }).in("status", ["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident"]),
  ]);
  const pricing = pricingResult.data; const services = servicesResult.data ?? []; const orders = ordersResult.data ?? [];
  return <><SiteHeader/><main className="mx-auto max-w-6xl px-4 py-8"><header><p className="font-bold text-sky-400">ADMINISTRACIÓN</p><h1 className="mt-2 text-3xl font-bold">Configuración de Delivery Ya</h1><p className="mt-2 text-sm text-zinc-400">Los pedidos se despachan solos: los cadetes online toman directamente los pedidos en cola.</p></header>
    {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{params.notice}</p>}{params.error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{params.error}</p>}
    <section className="mt-8 grid gap-3 sm:grid-cols-3"><Metric label="En cola esperando cadete" value={queueResult.count ?? 0}/><Metric label="Pedidos en curso" value={activeResult.count ?? 0}/><Metric label="Últimos pedidos" value={orders.length}/></section>
    <section className="mt-8 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><h2 className="text-lg font-bold">Tarifa vigente</h2>{pricing && <p className="mt-2 text-sm text-zinc-300">Base {money.format(pricing.base_price)} · mínimo {money.format(pricing.minimum_price)} · incluye {pricing.included_km} km · extra {money.format(pricing.price_per_extra_km)}/km</p>}<form action={createPricingRule} className="mt-5 grid gap-3 sm:grid-cols-2"><Field name="basePrice" label="Precio base" value={pricing?.base_price}/><Field name="minimumPrice" label="Precio mínimo" value={pricing?.minimum_price}/><Field name="includedKm" label="Km incluidos" value={pricing?.included_km}/><Field name="pricePerExtraKm" label="Valor km extra" value={pricing?.price_per_extra_km}/><button className="rounded-lg bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950 sm:col-span-2">Guardar tarifa</button></form></article>
      <article className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><h2 className="text-lg font-bold">Servicios disponibles</h2><form action={createServiceType} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"><input required name="code" placeholder="Código" className="rounded-lg bg-zinc-800 px-3 py-3 text-sm"/><input required name="name" placeholder="Nombre" className="rounded-lg bg-zinc-800 px-3 py-3 text-sm"/><button className="rounded-lg border border-sky-400/60 px-4 py-3 text-sm font-bold text-sky-300">Agregar</button></form><ul className="mt-4 divide-y divide-white/10">{services.map((service) => <li className="flex items-center justify-between gap-3 py-3" key={service.id}><span><b>{service.name}</b><small className="ml-2 text-zinc-500">{service.code}</small></span><form action={setServiceTypeStatus}><input type="hidden" name="id" value={service.id}/><input type="hidden" name="active" value={String(!service.active)}/><button className="rounded-lg border border-white/20 px-3 py-2 text-xs">{service.active ? "Pausar" : "Habilitar"}</button></form></li>)}</ul></article></section>
    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-5"><h2 className="text-lg font-bold">Monitoreo de pedidos</h2><p className="mt-1 text-sm text-zinc-400">Sólo lectura. La cola y la asignación son automáticas desde los cadetes.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-zinc-400"><tr><th className="pb-3">Pedido</th><th className="pb-3">Servicio</th><th className="pb-3">Estado</th><th className="pb-3">Total</th></tr></thead><tbody>{orders.map((order) => <tr className="border-b border-white/5" key={order.id}><td className="py-3 font-semibold">{order.tracking_code}</td><td className="py-3">{order.service_types?.[0]?.name ?? "Envío"}</td><td className="py-3">{order.status === "confirmed" ? "Esperando cadete" : order.status.replaceAll("_", " ")}</td><td className="py-3">{order.estimated_price === null ? "—" : money.format(order.estimated_price)}</td></tr>)}</tbody></table></div></section>
  </main></>;
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="rounded-xl border border-white/10 bg-zinc-900 p-4"><p className="text-sm text-zinc-400">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></article>; }
function Field({ name, label, value }: { name: string; label: string; value?: number }) { return <label className="grid gap-1 text-sm">{label}<input required type="number" min="0" step="0.01" name={name} defaultValue={value} className="rounded-lg bg-zinc-800 px-3 py-3"/></label>; }
