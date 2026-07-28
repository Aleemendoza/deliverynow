"use client";

import { useCallback, useEffect, useState } from "react";
import { CourierOfferCard, type CourierOffer } from "@/components/courier/courier-offer-card";
import { useCourierAvailability } from "@/components/courier/courier-availability-context";
import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";

type OffersResponse = { code?: string; offers?: CourierOffer[]; message?: string };

export function NearbyOffers() {
  const { online, markUnavailable } = useCourierAvailability();
  const [offers, setOffers] = useState<CourierOffer[] | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!online) return;
    try {
      const response = await authenticatedFetch("/api/courier/offers", { cache: "no-store" });
      const payload = await response.json() as OffersResponse;
      if (!response.ok) {
        if (payload.code === "COURIER_OFFLINE") markUnavailable();
        throw new Error(payload.message ?? "No se pudo cargar la cola de pedidos.");
      }
      setOffers(payload.offers ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la cola de pedidos.");
      setOffers([]);
    }
  }, [markUnavailable, online]);

  useEffect(() => {
    if (!online) {
      const reset = window.setTimeout(() => { setOffers(null); setMessage(""); }, 0);
      return () => window.clearTimeout(reset);
    }
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, [load, online]);

  if (!online) return <div className="rounded-xl border border-dashed border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">Activá tu disponibilidad y permití compartir tu ubicación para ver y tomar pedidos.</div>;
  if (offers === null) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">Cargando la cola de pedidos…</div>;
  if (!offers.length) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">{message || "No hay pedidos esperando cadete en este momento."}</div>;
  return <div className="grid gap-4">{offers.map((offer) => <CourierOfferCard key={offer.id} offer={offer} onAvailabilityLost={markUnavailable}/>)}</div>;
}
