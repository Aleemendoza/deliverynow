"use client";
import Link from "next/link";
import { useState } from "react";

export function QuickEstimator() {
 const [pickup, setPickup] = useState(""); const [delivery, setDelivery] = useState("");
 return <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"><h2 className="mb-4 text-lg font-bold">Calculá tu envío</h2><div className="grid gap-3 md:grid-cols-3"><input aria-label="Dirección de retiro" value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="¿Dónde retiramos?" className="rounded-lg bg-zinc-800 px-4 py-3 outline-none ring-yellow-400 focus:ring-2"/><input aria-label="Dirección de entrega" value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="¿Dónde entregamos?" className="rounded-lg bg-zinc-800 px-4 py-3 outline-none ring-yellow-400 focus:ring-2"/><Link href={`/solicitar?pickup=${encodeURIComponent(pickup)}&delivery=${encodeURIComponent(delivery)}`} className="rounded-lg bg-yellow-400 px-4 py-3 text-center font-bold text-black">Continuar</Link></div><p className="mt-3 text-xs text-zinc-400">El precio final se calcula con una ruta verificada antes de confirmar.</p></section>
}
