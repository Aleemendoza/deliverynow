import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { humanizeOrderStatus } from "@/lib/orders/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Customer = { id: string };
type Order = { id: string; tracking_code: string; status: string; created_at: string; scheduled_at: string | null; estimated_price: number | null; final_price: number | null; service_types: { name: string } | null };
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default async function CustomerOrdersPage() {
  const { profile } = await requireRole("customer");
  const database = getSupabaseServerClient();
  const { data: customer } = await database.from("customers").select("id").eq("profile_id", profile.id).maybeSingle<Customer>();
  const { data } = customer
    ? await database.from("orders").select("id,tracking_code,status,created_at,scheduled_at,estimated_price,final_price,service_types(name)").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(50).returns<Order[]>()
    : { data: [] as Order[] };
  const orders = data ?? [];

  return <><SiteHeader/><main className="mx-auto max-w-4xl px-4 py-10"><header><p className="font-bold text-brand">SEGUIMIENTO</p><h1 className="mt-2 text-3xl font-bold">Mis pedidos</h1><p className="mt-2 text-zinc-400">Consulta el avance de tus envios sin exponer datos privados del cadete.</p></header>
    <section className="mt-7 grid gap-3">{orders.length ? orders.map((order) => { const total = order.final_price ?? order.estimated_price; return <article key={order.id} className="rounded-2xl border border-white/10 bg-zinc-900 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold text-brand">{order.tracking_code}</p><h2 className="mt-1 text-lg font-bold">{order.service_types?.name ?? "Envio"}</h2><p className="mt-1 text-sm text-zinc-400">{humanizeOrderStatus(order.status)}</p></div><div className="text-right text-sm text-zinc-400"><p>{new Date(order.created_at).toLocaleString("es-AR")}</p><p className="mt-1 font-semibold text-zinc-100">{total === null ? "Total a confirmar" : money.format(Number(total))}</p></div></div><Link href={`/seguimiento/${encodeURIComponent(order.tracking_code)}`} className="mt-4 inline-block text-sm font-bold text-brand">Ver seguimiento protegido</Link></article>; }) : <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/60 p-8 text-center text-zinc-400">Todavia no tenes pedidos asociados a esta cuenta.</div>}</section>
  </main></>;
}
