import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { TrackingLookup } from "@/components/tracking/tracking-lookup";
export default async function Tracking({ searchParams }: { searchParams: Promise<{ code?: string }> }) { const { code } = await searchParams; return <><SiteHeader/><main className="mx-auto max-w-lg px-4 py-16"><p className="font-bold text-yellow-400">SEGUIMIENTO</p><h1 className="mt-2 text-3xl font-bold">¿Dónde está tu pedido?</h1><p className="mt-3 text-zinc-400">Validá el código y el correo que usaste al solicitarlo. No mostramos direcciones ni teléfonos.</p><TrackingLookup initialCode={code ?? ""}/><Link href="/contacto" className="mt-6 block text-sm text-yellow-400">¿No encontrás el código? Contactanos.</Link></main></>}
