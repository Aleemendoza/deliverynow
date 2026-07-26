"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google/maps-loader";

type Coordinates = { latitude: number; longitude: number };
type MapCoordinates = { lat: number; lng: number };
type LatLng = { lat: () => number; lng: () => number };
type MapInstance = { fitBounds: (bounds: BoundsInstance, padding: number | { top: number; right: number; bottom: number; left: number }) => void };
type BoundsInstance = { extend: (position: MapCoordinates | LatLng) => void };

type Props = { pickup: Coordinates; delivery: Coordinates; encodedPolyline: string };

export function RouteMap({ pickup, delivery, encodedPolyline }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !element.current || !encodedPolyline) return;
    let cancelled = false;

    const drawRoute = async () => {
      try {
        const google = await loadGoogleMaps(apiKey);
        const mapsLibrary = await google.maps.importLibrary("maps") as {
          Map: new (element: HTMLDivElement, options: object) => MapInstance;
          Polyline: new (options: { map: MapInstance; path: LatLng[]; strokeColor: string; strokeOpacity: number; strokeWeight: number }) => unknown;
          LatLngBounds: new () => BoundsInstance;
        };
        const markerLibrary = await google.maps.importLibrary("marker") as {
          Marker: new (options: { map: MapInstance; position: MapCoordinates; label: string; title: string }) => unknown;
        };
        const geometryLibrary = await google.maps.importLibrary("geometry") as { encoding: { decodePath: (encodedPath: string) => LatLng[] } };
        if (cancelled || !element.current) return;

        const map = new mapsLibrary.Map(element.current, { disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy" });
        const start = { lat: pickup.latitude, lng: pickup.longitude };
        const end = { lat: delivery.latitude, lng: delivery.longitude };
        const path = geometryLibrary.encoding.decodePath(encodedPolyline);
        const bounds = new mapsLibrary.LatLngBounds();
        bounds.extend(start);
        bounds.extend(end);
        path.forEach((point) => bounds.extend(point));
        new markerLibrary.Marker({ map, position: start, label: "R", title: "Retiro" });
        new markerLibrary.Marker({ map, position: end, label: "E", title: "Entrega" });
        new mapsLibrary.Polyline({ map, path, strokeColor: "#38bdf8", strokeOpacity: 0.9, strokeWeight: 5 });
        map.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
      } catch {
        if (!cancelled) setError("No pudimos mostrar el recorrido en el mapa.");
      }
    };

    void drawRoute();
    return () => { cancelled = true; };
  }, [apiKey, delivery.latitude, delivery.longitude, encodedPolyline, pickup.latitude, pickup.longitude]);

  if (!apiKey) return <p className="mt-4 text-sm text-info">Configurá Google Maps para ver el recorrido.</p>;
  return <section className="mt-5"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPinned className="size-4 text-brand" />Recorrido verificado</div><div ref={element} className="h-64 overflow-hidden rounded-xl border border-white/10 bg-surface" aria-label="Mapa del recorrido entre retiro y entrega" />{error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}<p className="mt-2 text-xs text-zinc-400">R: retiro · E: entrega. El trayecto mostrado es la ruta calculada para este pedido.</p></section>;
}
