"use client";

import { useCallback, useEffect, useState } from "react";
import { CourierOfferCard, type CourierOffer } from "@/components/courier/courier-offer-card";
import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";

type OffersResponse = { offers?: CourierOffer[]; message?: string };

export function NearbyOffers() {
  const [offers, setOffers] = useState<CourierOffer[] | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await authenticatedFetch("/api/courier/offers", { cache: "no-store" });
      const payload = await response.json() as OffersResponse;
      if (!response.ok) throw new Error(payload.message ?? "No se pudo cargar la cola de pedidos.");
      setOffers(payload.offers ?? []); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar la cola de pedidos."); setOffers([]); }
  }, []);
  useEffect(() => { void load(); const interval = window.setInterval(() => void load(), 15_000); return () => window.clearInterval(interval); }, [load]);
  if (offers === null) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">Cargando la cola de pedidos…</div>;
  if (!offers.length) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">{message || "No hay pedidos esperando cadete en este momento."}</div>;
  return <div className="grid gap-4">{offers.map((offer) => <CourierOfferCard key={offer.id} offer={offer}/>)}</div>;
}
