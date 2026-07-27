"use client";

import { useEffect, useRef, useState } from "react";

const UPDATE_INTERVAL_MS = 60_000;

export function CourierPresence({ online }: { online: boolean }) {
  const lastSentAt = useRef(0);
  const [message, setMessage] = useState(online ? "Ubicación pendiente de activar." : "Activá tu disponibilidad para compartir ubicación.");
  const locationUnsupported = typeof navigator !== "undefined" && !navigator.geolocation;

  useEffect(() => {
    if (!online || locationUnsupported) return;
    const send = (position: GeolocationPosition) => {
      if (Date.now() - lastSentAt.current < UPDATE_INTERVAL_MS) return;
      lastSentAt.current = Date.now();
      void fetch("/api/courier/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }) }).then((response) => setMessage(response.ok ? "Ubicación activa para ordenar ofertas cercanas." : "No pudimos actualizar tu ubicación.")).catch(() => setMessage("No pudimos actualizar tu ubicación."));
    };
    const watchId = navigator.geolocation.watchPosition(send, () => setMessage("Permití la ubicación para ordenar ofertas cercanas."), { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, locationUnsupported]);

  return <p className="mt-3 text-sm text-zinc-400" role="status">{locationUnsupported ? "Este navegador no permite compartir ubicación." : message}</p>;
}
