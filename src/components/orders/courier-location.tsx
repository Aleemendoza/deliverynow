"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useRealtimeSubscription } from "@/lib/realtime/subscription";

type Location = { latitude: number; longitude: number; observedAt: string } | null;

export function CourierLocation({ orderId, active }: { orderId: string; active: boolean }) {
  const [location, setLocation] = useState<Location>(null);
  const load = useCallback(async () => {
    if (!active) return;
    const response = await fetch(`/api/orders/${orderId}/courier-location`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { location: Location };
    setLocation(payload.location);
  }, [active, orderId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useRealtimeSubscription({ topic: `order:${orderId}`, event: "courier.location_changed", onEvent: load, enabled: active });
  if (!active) return null;
  return <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><MapPin className="size-3.5 text-brand"/>{location ? `Ubicación del cadete actualizada ${new Date(location.observedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.` : "Esperando ubicación actual del cadete."}</p>;
}
