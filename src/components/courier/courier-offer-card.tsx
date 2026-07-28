"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";

export type CourierOffer = { id: string; trackingCode: string; createdAt: string; scheduledAt: string | null; estimatedPrice: number | null; routeDistanceMeters: number | null; routeDurationSeconds: number | null; serviceName: string };

export function CourierOfferCard({ offer, onAvailabilityLost }: { offer: CourierOffer; onAvailabilityLost: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function accept() {
    setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetch(`/api/courier/offers/${offer.id}/accept`, { method: "POST" });
      const payload = await response.json() as { code?: string; message?: string };
      if (!response.ok) {
        if (payload.code === "COURIER_OFFLINE") onAvailabilityLost();
        throw new Error(payload.message ?? "El pedido ya no está disponible.");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos tomar el pedido.");
    } finally { setBusy(false); }
  }

  return <article className="rounded-2xl border border-sky-400/20 bg-zinc-900 p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-brand">EN COLA · DISPONIBLE</p><h2 className="mt-1 break-words text-lg font-bold">{offer.serviceName}</h2><p className="mt-1 text-sm text-zinc-400">Código {offer.trackingCode}</p></div><p className="font-bold text-brand">${Number(offer.estimatedPrice ?? 0).toLocaleString("es-AR")}</p></div><div className="mt-5 grid gap-2 text-sm text-zinc-300"><span className="inline-flex items-center gap-1"><MapPin className="size-4 shrink-0 text-sky-300"/>{offer.routeDistanceMeters ? `${(offer.routeDistanceMeters / 1000).toFixed(1)} km de recorrido` : "Recorrido a confirmar"}</span>{offer.routeDurationSeconds && <span>{Math.max(1, Math.round(offer.routeDurationSeconds / 60))} min estimados</span>}</div><p className="mt-4 text-xs text-zinc-500">El primero que lo toma queda asignado. Los datos privados se habilitan al aceptarlo.</p><button disabled={busy} onClick={() => void accept()} className="mt-5 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50">{busy ? "Tomando…" : "Tomar pedido"}</button>{message && <p role="alert" className="mt-3 text-sm text-red-400">{message}</p>}</article>;
}
