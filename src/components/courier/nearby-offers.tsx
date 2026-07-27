"use client";

import { useCallback, useEffect, useState } from "react";
import { CourierOfferCard, type CourierOffer } from "@/components/courier/courier-offer-card";
import { useRealtimeSubscription } from "@/lib/realtime/subscription";

type OffersResponse = { offers?: CourierOffer[]; message?: string };
type Coordinates = { latitude: number; longitude: number };

export function NearbyOffers() {
  const [offers, setOffers] = useState<CourierOffer[] | null>(null);
  const [message, setMessage] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates>();
  const locationUnsupported = typeof navigator !== "undefined" && !navigator.geolocation;
  const load = useCallback(async (origin = coordinates) => {
    if (!origin) return;
    try {
      const query = new URLSearchParams({ latitude: String(origin.latitude), longitude: String(origin.longitude) });
      const response = await fetch(`/api/courier/offers?${query}`, { cache: "no-store" });
      const payload = await response.json() as OffersResponse;
      if (!response.ok) throw new Error(payload.message ?? "No se pudieron cargar las ofertas.");
      setOffers(payload.offers ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron cargar las ofertas."); setOffers([]); }
  }, [coordinates]);
  useEffect(() => {
    if (locationUnsupported) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCoordinates(origin); void load(origin);
    }, () => { setMessage("Permití la ubicación para ordenar las ofertas por cercanía."); setOffers([]); }, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });
  }, [load, locationUnsupported]);
  useRealtimeSubscription({ topic: "courier-offers", event: "offer.changed", onEvent: () => void load(), enabled: Boolean(coordinates) });
  if (locationUnsupported) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">Tu navegador no permite ordenar las ofertas por cercanía.</div>;
  if (offers === null) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">Buscando ofertas cercanas…</div>;
  if (!offers.length) return <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/60 p-6 text-sm text-zinc-400">{message || "No hay pedidos disponibles cerca tuyo en este momento."}</div>;
  return <div className="grid gap-4">{offers.map((offer) => <CourierOfferCard key={offer.id} offer={offer}/>)}</div>;
}
