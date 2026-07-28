import { OrderWizard } from "@/components/orders/order-wizard";
import { OrderPushGate } from "@/components/orders/order-push-gate";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const { profile } = await requireRole("customer");
  if (!profile.full_name?.trim()) return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-bold">Completa los datos de tu cuenta</h1><p className="mt-3 text-zinc-400">Necesitamos tu nombre completo antes de poder identificarte como remitente en cada pedido.</p><Link href="/account" className="mt-6 inline-block rounded-lg bg-brand px-4 py-3 text-sm font-bold text-brand-foreground">Completar mi cuenta</Link></main></>;

  return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10"><div><p className="font-bold text-yellow-400">NUEVO PEDIDO</p><h1 className="mt-2 text-3xl font-bold">Solicita tu envio</h1><p className="mt-2 text-zinc-400">El remitente sera el titular de la cuenta. Solo necesitas cargar los datos de quien recibe.</p></div><OrderPushGate><OrderWizard senderName={profile.full_name} /></OrderPushGate></main></>;
}
