import { OrderWizard } from "@/components/orders/order-wizard";
import { SiteHeader } from "@/components/site-header";
export default function RequestPage(){ return <><SiteHeader/><main className="mx-auto max-w-3xl px-4 py-10"><p className="font-bold text-yellow-400">NUEVO PEDIDO</p><h1 className="mt-2 text-3xl font-bold">Solicitá tu envío</h1><p className="mt-2 text-zinc-400">Completá los pasos. Tus datos se conservan localmente hasta confirmar.</p><OrderWizard/></main></> }
