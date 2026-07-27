"use client";

import { useEffect, useRef, useState } from "react";

const AVAILABLE_UPDATE_INTERVAL_MS = 60_000;
const ACTIVE_UPDATE_INTERVAL_MS = 15_000;
const MIN_MOVEMENT_METERS = 25;

export function CourierPresence({ online, hasActiveOrder = false }: { online: boolean; hasActiveOrder?: boolean }) {
  const lastSentAt = useRef(0);
  const lastPosition = useRef<GeolocationCoordinates | null>(null);
  const [message, setMessage] = useState(online ? "Ubicación pendiente de activar." : "Activá tu disponibilidad para compartir ubicación.");
  const locationUnsupported = typeof navigator !== "undefined" && !navigator.geolocation;
  useEffect(() => {
    if (!online || locationUnsupported) return;
    const send = (position: GeolocationPosition) => {
      const interval = hasActiveOrder ? ACTIVE_UPDATE_INTERVAL_MS : AVAILABLE_UPDATE_INTERVAL_MS;
      const previous = lastPosition.current;
      const latitudeDelta = previous ? (position.coords.latitude - previous.latitude) * 111_000 : Infinity;
      const longitudeDelta = previous ? (position.coords.longitude - previous.longitude) * 111_000 * Math.cos(position.coords.latitude * Math.PI / 180) : Infinity;
      if (Math.hypot(latitudeDelta, longitudeDelta) < MIN_MOVEMENT_METERS && Date.now() - lastSentAt.current < interval) return;
      lastSentAt.current = Date.now(); lastPosition.current = position.coords;
      void fetch("/api/courier/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }) }).then((response) => setMessage(response.ok ? "Ubicación activa para ordenar ofertas cercanas." : "No pudimos actualizar tu ubicación.")).catch(() => setMessage("No pudimos actualizar tu ubicación."));
    };
    const watchId = navigator.geolocation.watchPosition(send, () => setMessage("Permití la ubicación para ordenar ofertas cercanas."), { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasActiveOrder, locationUnsupported, online]);
  return <p className="mt-3 text-sm text-zinc-400" role="status">{locationUnsupported ? "Este navegador no permite compartir ubicación." : message}</p>;
}
