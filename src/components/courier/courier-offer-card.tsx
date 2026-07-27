"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type CourierOffer = { id: string; attemptId: string; expiresAt: string; trackingCode: string; status: "confirmed"; createdAt: string; scheduledAt: string | null; estimatedPrice: number | null; routeDistanceMeters: number | null; routeDurationSeconds: number | null; serviceName: string; pickupDistanceKm: number };

export function CourierOfferCard({ offer }: { offer: CourierOffer }) {
  const router = useRouter(); const [now, setNow] = useState(0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  const seconds = now ? Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000)) : 45;
  const accept = async () => { setBusy(true); setMessage(""); try { const response = await fetch(`/api/courier/offers/${offer.attemptId}/accept`, { method: "POST" }); const payload = await response.json() as { message?: string }; if (!response.ok) throw new Error(payload.message ?? "La oferta ya no está disponible."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos aceptar la oferta."); } finally { setBusy(false); } };
  return <article className="rounded-2xl border border-sky-400/20 bg-zinc-900 p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-brand">Oferta exclusiva</p><h2 className="mt-1 break-words text-lg font-bold">{offer.serviceName}</h2><p className="mt-1 text-sm text-zinc-400">Código {offer.trackingCode}</p></div><div><p className="font-bold text-brand">${Number(offer.estimatedPrice ?? 0).toLocaleString("es-AR")}</p><p className={`mt-1 text-xs font-bold ${seconds ? "text-amber-300" : "text-red-300"}`}>{seconds ? `Vence en ${seconds}s` : "Oferta vencida"}</p></div></div><div className="mt-5 grid gap-2 text-sm text-zinc-300"><span className="inline-flex items-center gap-1"><MapPin className="size-4 shrink-0 text-sky-300"/>{offer.routeDistanceMeters ? `${(offer.routeDistanceMeters / 1000).toFixed(1)} km de recorrido` : "Recorrido a confirmar"}</span>{offer.routeDurationSeconds && <span>{Math.max(1, Math.round(offer.routeDurationSeconds / 60))} min estimados</span>}</div><p className="mt-4 text-xs text-zinc-500">La dirección y los contactos se habilitan al aceptar el pedido.</p><button disabled={busy || !seconds} onClick={() => void accept()} className="mt-5 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Aceptando…" : "Aceptar pedido"}</button>{message && <p role="alert" className="mt-3 text-sm text-red-400">{message}</p>}</article>;
}
