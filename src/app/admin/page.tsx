import { assignOrder, changeOrderStatus, createPricingRule, createServiceType, setServiceTypeStatus } from "./actions";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

type SearchParams = Promise<{ notice?: string; error?: string }>;
type PricingRule = { id: string; base_price: number; included_km: number; price_per_extra_km: number; minimum_price: number; valid_from: string };
type ServiceType = { id: string; code: string; name: string; active: boolean };
type Courier = { id: string; is_online: boolean; profiles: Array<{ full_name: string | null; email: string | null }> | null };
type Order = { id: string; tracking_code: string; guest_name: string | null; guest_email: string | null; status: string; estimated_price: number | null; created_at: string; service_types: Array<{ name: string }> | null };

const activeStatuses = ["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery"];
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("admin");
  const database = getSupabaseServerClient();
  const now = new Date().toISOString();
  const [params, totalResult, activeResult, deliveredResult, incidentResult, pricingResult, servicesResult, ordersResult, couriersResult] = await Promise.all([
    searchParams,
    database.from("orders").select("id", { count: "exact", head: true }),
    database.from("orders").select("id", { count: "exact", head: true }).in("status", activeStatuses),
    database.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    database.from("orders").select("id", { count: "exact", head: true }).eq("status", "incident"),
    database.from("pricing_rules").select("id,base_price,included_km,price_per_extra_km,minimum_price,valid_from").lte("valid_from", now).or(`valid_to.is.null,valid_to.gt.${now}`).order("valid_from", { ascending: false }).limit(1).maybeSingle<PricingRule>(),
    database.from("service_types").select("id,code,name,active").order("name"),
    database.from("orders").select("id,tracking_code,guest_name,guest_email,status,estimated_price,created_at,service_types(name)").order("created_at", { ascending: false }).limit(20),
    database.from("couriers").select("id,is_online,profiles(full_name,email)").eq("is_active", true).order("created_at", { ascending: false }),
  ]);
  const metrics = [["Pedidos", totalResult.count ?? 0], ["Activos", activeResult.count ?? 0], ["Completados", deliveredResult.count ?? 0], ["Incidentes", incidentResult.count ?? 0]];
  const currentPricing = pricingResult.data;
  const services = (servicesResult.data ?? []) as ServiceType[];
  const orders = (ordersResult.data ?? []) as Order[];
  const couriers = (couriersResult.data ?? []) as Courier[];

  return <><SiteHeader/><main className="mx-auto max-w-6xl px-4 py-8">
    <header><p className="font-bold text-sky-400">ADMINISTRACIÓN</p><h1 className="mt-2 text-3xl font-bold">Operación de Delivery Now</h1><p className="mt-2 text-sm text-zinc-400">Configurá los servicios, la tarifa y la asignación de pedidos desde un único lugar.</p></header>
    {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{params.notice}</p>}
    {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{params.error}</p>}

    <section className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">{metrics.map(([label, value]) => <article className="rounded-xl border border-white/10 bg-zinc-900 p-4" key={String(label)}><p className="text-sm text-zinc-400">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></article>)}</section>

    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Tarifa vigente</h2><p className="mt-1 text-sm text-zinc-400">Al guardar una nueva tarifa, la anterior queda cerrada automáticamente.</p></div><span className={currentPricing ? "rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300" : "rounded-full bg-red-400/15 px-3 py-1 text-xs font-semibold text-red-300"}>{currentPricing ? "Activa" : "Sin configurar"}</span></div>
        {currentPricing && <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-black/20 p-4 text-sm"><div><dt className="text-zinc-400">Base</dt><dd className="font-semibold">{money.format(currentPricing.base_price)}</dd></div><div><dt className="text-zinc-400">Mínimo</dt><dd className="font-semibold">{money.format(currentPricing.minimum_price)}</dd></div><div><dt className="text-zinc-400">Incluye</dt><dd className="font-semibold">{currentPricing.included_km} km</dd></div><div><dt className="text-zinc-400">Km extra</dt><dd className="font-semibold">{money.format(currentPricing.price_per_extra_km)}</dd></div></dl>}
        <form action={createPricingRule} className="mt-5 grid gap-3 sm:grid-cols-2"><NumberField name="basePrice" label="Precio base" defaultValue={currentPricing?.base_price} /><NumberField name="minimumPrice" label="Precio mínimo" defaultValue={currentPricing?.minimum_price} /><NumberField name="includedKm" label="Km incluidos" defaultValue={currentPricing?.included_km} step="0.1" /><NumberField name="pricePerExtraKm" label="Valor por km extra" defaultValue={currentPricing?.price_per_extra_km} /><button className="rounded-lg bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950 sm:col-span-2">Guardar nueva tarifa</button></form>
      </article>

      <article className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><h2 className="text-lg font-bold">Servicios disponibles</h2><p className="mt-1 text-sm text-zinc-400">Los servicios pausados dejan de aparecer al solicitar un envío.</p><form action={createServiceType} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"><input required name="code" placeholder="codigo, ej. express" className="rounded-lg bg-zinc-800 px-3 py-3 text-sm" /><input required name="name" placeholder="Nombre visible" className="rounded-lg bg-zinc-800 px-3 py-3 text-sm" /><button className="rounded-lg border border-sky-400/60 px-4 py-3 text-sm font-bold text-sky-300">Agregar</button></form><ul className="mt-5 divide-y divide-white/10">{services.length ? services.map((service) => <li className="flex items-center justify-between gap-3 py-3" key={service.id}><div><p className="font-medium">{service.name}</p><p className="text-xs text-zinc-500">{service.code}</p></div><form action={setServiceTypeStatus}><input type="hidden" name="id" value={service.id} /><input type="hidden" name="active" value={String(!service.active)} /><button className={service.active ? "rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-300" : "rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-300"}>{service.active ? "Pausar" : "Habilitar"}</button></form></li>) : <li className="py-4 text-sm text-zinc-400">Todavía no hay servicios configurados.</li>}</ul></article>
    </section>

    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-5"><div><h2 className="text-lg font-bold">Bandeja de pedidos</h2><p className="mt-1 text-sm text-zinc-400">Últimos 20 pedidos. Confirmá, rechazá o asigná cada pedido desde esta bandeja.</p></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-zinc-400"><tr><th className="pb-3 pr-4">Pedido</th><th className="pb-3 pr-4">Cliente</th><th className="pb-3 pr-4">Servicio</th><th className="pb-3 pr-4">Total</th><th className="pb-3 pr-4">Estado</th><th className="pb-3">Acción</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr className="border-b border-white/5" key={order.id}><td className="py-4 pr-4 font-semibold">{order.tracking_code}<span className="mt-1 block text-xs font-normal text-zinc-500">{new Date(order.created_at).toLocaleString("es-AR")}</span></td><td className="py-4 pr-4">{order.guest_name ?? "—"}<span className="mt-1 block text-xs text-zinc-500">{order.guest_email ?? ""}</span></td><td className="py-4 pr-4">{order.service_types?.[0]?.name ?? "—"}</td><td className="py-4 pr-4">{order.estimated_price === null ? "—" : money.format(order.estimated_price)}</td><td className="py-4 pr-4"><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{order.status.replaceAll("_", " ")}</span></td><td className="py-4">{order.status === "pending_confirmation" ? <div className="flex gap-2"><StatusButton orderId={order.id} status="confirmed" label="Confirmar" tone="sky" /><StatusButton orderId={order.id} status="rejected" label="Rechazar" tone="red" /></div> : order.status === "confirmed" ? <form action={assignOrder} className="flex min-w-48 gap-2"><input type="hidden" name="orderId" value={order.id} /><select required name="courierId" defaultValue="" className="min-w-0 rounded-lg bg-zinc-800 px-2 py-2 text-xs"><option value="" disabled>Asignar cadete</option>{couriers.map((courier) => <option value={courier.id} key={courier.id}>{courier.profiles?.[0]?.full_name || courier.profiles?.[0]?.email || "Cadete"}{courier.is_online ? " · online" : ""}</option>)}</select><button disabled={!couriers.length} className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Asignar</button></form> : <span className="text-xs text-zinc-500">Sin acción</span>}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-zinc-400">Aún no hay pedidos.</td></tr>}</tbody></table></div></section>
  </main></>;
}

function NumberField({ name, label, defaultValue, step = "1" }: { name: string; label: string; defaultValue?: number; step?: string }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input required name={name} type="number" min="0" step={step} defaultValue={defaultValue} className="rounded-lg bg-zinc-800 px-3 py-3" /></label>;
}

function StatusButton({ orderId, status, label, tone }: { orderId: string; status: "confirmed" | "rejected"; label: string; tone: "sky" | "red" }) {
  return <form action={changeOrderStatus}><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="status" value={status} /><button className={tone === "sky" ? "rounded-lg bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950" : "rounded-lg border border-red-400/50 px-3 py-2 text-xs font-bold text-red-300"}>{label}</button></form>;
}
