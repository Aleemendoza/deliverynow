"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { UseFormSetValue } from "react-hook-form";
import type { OrderDraft } from "@/features/orders/schema";
import { loadGoogleMaps } from "@/lib/google/maps-loader";
import { distanceInKm, isWithinServiceArea, SERVICE_RADIUS_KM, VILLA_CONSTITUCION_CENTER } from "@/lib/service-area";

type AddressKey = "pickup" | "delivery";
type Coordinates = { lat: number; lng: number };
type AddressComponent = { longText?: string; types?: string[] };
type SelectedPlace = { id?: string; formattedAddress?: string; location?: { lat: () => number; lng: () => number }; addressComponents?: AddressComponent[]; fetchFields: (options: { fields: string[] }) => Promise<void> };
type PlaceAutocompleteElement = HTMLElement & { value?: string; placeholder: string; includedRegionCodes: string[]; locationRestriction: { north: number; south: number; east: number; west: number } };
type PlaceSelectionEvent = Event & { placePrediction: { placeId?: string; toPlace: () => SelectedPlace } };
type LatLng = { lat: () => number; lng: () => number };
type MarkerPosition = Coordinates | LatLng | null | undefined;
type MapInstance = { setCenter: (position: Coordinates) => void; setZoom: (zoom: number) => void; addListener: (eventName: "click", callback: (event: { latLng?: LatLng }) => void) => void };
type AdvancedMarker = { position: MarkerPosition; map: MapInstance | null; addListener: (eventName: "dragend", callback: () => void) => void };
type Props = { name: AddressKey; label: string; setValue: UseFormSetValue<OrderDraft>; value?: string; error?: string };

const mapCenter: Coordinates = { lat: VILLA_CONSTITUCION_CENTER.latitude, lng: VILLA_CONSTITUCION_CENTER.longitude };

function toCoordinates(position: MarkerPosition): Coordinates | undefined {
  if (!position) return undefined;
  const lat = typeof position.lat === "function" ? position.lat() : position.lat;
  const lng = typeof position.lng === "function" ? position.lng() : position.lng;
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng) ? { lat, lng } : undefined;
}

export function AddressPicker({ name, label, setValue, value, error }: Props) {
  const autocompleteHost = useRef<HTMLDivElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const initialValue = useRef(value ?? "");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [areaError, setAreaError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

  useEffect(() => {
    if (!apiKey || !autocompleteHost.current || !mapElement.current) return;
    let cancelled = false;
    let autocompleteElement: PlaceAutocompleteElement | undefined;
    let marker: AdvancedMarker | undefined;

    const initialize = async () => {
      try {
        const google = await loadGoogleMaps(apiKey);
        const mapsLibrary = await google.maps.importLibrary("maps") as { Map: new (element: HTMLDivElement, options: object) => MapInstance };
        const markerLibrary = await google.maps.importLibrary("marker") as { AdvancedMarkerElement: new (options: { map: MapInstance; position: Coordinates; gmpDraggable: boolean; title: string }) => AdvancedMarker };
        const placesLibrary = await google.maps.importLibrary("places") as { PlaceAutocompleteElement: new () => PlaceAutocompleteElement };
        if (cancelled || !autocompleteHost.current || !mapElement.current) return;

        const map = new mapsLibrary.Map(mapElement.current, { center: mapCenter, zoom: 12, mapId, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy" });
        const latitudeDelta = SERVICE_RADIUS_KM / 111;
        const longitudeDelta = SERVICE_RADIUS_KM / (111 * Math.cos(mapCenter.lat * Math.PI / 180));
        autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
        autocompleteElement.placeholder = "Buscá calle y altura";
        autocompleteElement.value = initialValue.current;
        autocompleteElement.includedRegionCodes = ["ar"];
        autocompleteElement.locationRestriction = { north: mapCenter.lat + latitudeDelta, south: mapCenter.lat - latitudeDelta, east: mapCenter.lng + longitudeDelta, west: mapCenter.lng - longitudeDelta };
        autocompleteHost.current.replaceChildren(autocompleteElement);

        let selectedAddress = false;
        let lastValidPosition: Coordinates | undefined;
        const updateMarkerPosition = (position: Coordinates) => {
          const coordinates = { latitude: position.lat, longitude: position.lng };
          if (!isWithinServiceArea(coordinates)) {
            setAreaError(`Este punto está a ${distanceInKm(VILLA_CONSTITUCION_CENTER, coordinates).toFixed(1)} km. La cobertura es de hasta ${SERVICE_RADIUS_KM} km desde Villa Constitución.`);
            setValue(`${name}.mapConfirmed`, false, { shouldValidate: true });
            if (marker && lastValidPosition) marker.position = lastValidPosition;
            return;
          }
          lastValidPosition = position;
          setAreaError("");
          setValue(`${name}.latitude`, position.lat, { shouldValidate: true });
          setValue(`${name}.longitude`, position.lng, { shouldValidate: true });
          setValue(`${name}.mapConfirmed`, true, { shouldValidate: true });
          if (marker) marker.position = position;
          else {
            marker = new markerLibrary.AdvancedMarkerElement({ map, position, gmpDraggable: true, title: `Ubicación de ${name === "pickup" ? "retiro" : "entrega"}` });
            marker.addListener("dragend", () => { const draggedPosition = toCoordinates(marker?.position); if (draggedPosition) updateMarkerPosition(draggedPosition); });
          }
        };

        map.addListener("click", (event) => {
          if (!selectedAddress) { setAreaError("Primero elegí una dirección sugerida; después podés ajustar el pin en el mapa."); return; }
          const position = toCoordinates(event.latLng); if (position) updateMarkerPosition(position);
        });

        autocompleteElement.addEventListener("gmp-select", async (event) => {
          try {
            const prediction = (event as PlaceSelectionEvent).placePrediction;
            const place = prediction?.toPlace(); if (!place) return;
            await place.fetchFields({ fields: ["id", "formattedAddress", "location", "addressComponents"] });
            const position = toCoordinates(place.location); if (!position) { setAreaError("No pudimos obtener coordenadas válidas para esa dirección."); return; }
            if (!isWithinServiceArea({ latitude: position.lat, longitude: position.lng })) { setAreaError(`Esta dirección está fuera del radio de ${SERVICE_RADIUS_KM} km de Villa Constitución.`); setValue(`${name}.mapConfirmed`, false, { shouldValidate: true }); return; }
            const formattedAddress = place.formattedAddress ?? ""; const placeId = place.id ?? prediction.placeId ?? "";
            if (!formattedAddress || !placeId) { setAreaError("Google no devolvió todos los datos para confirmar esta dirección. Elegí otra sugerencia."); return; }
            const part = (type: string) => place.addressComponents?.find((component) => component.types?.includes(type))?.longText ?? "";
            setValue(`${name}.formattedAddress`, formattedAddress, { shouldValidate: true }); setValue(`${name}.placeId`, placeId, { shouldValidate: true }); setValue(`${name}.city`, part("locality") || part("administrative_area_level_2"), { shouldValidate: true }); setValue(`${name}.province`, part("administrative_area_level_1"), { shouldValidate: true }); setValue(`${name}.postalCode`, part("postal_code")); setValue(`${name}.streetNumber`, part("street_number"));
            selectedAddress = true; map.setCenter(position); map.setZoom(16); updateMarkerPosition(position);
          } catch (selectionError) { console.error("No se pudo confirmar la dirección seleccionada.", selectionError); setAreaError("No pudimos confirmar esa dirección. Intentá seleccionar otra sugerencia."); setValue(`${name}.mapConfirmed`, false, { shouldValidate: true }); }
        });
        setReady(true);
      } catch (mapError) { console.error("No se pudo inicializar el mapa.", mapError); if (!cancelled) setLoadError("No se pudo cargar el buscador de direcciones. Revisá la configuración de Google Maps."); }
    };
    void initialize();
    return () => { cancelled = true; if (marker) marker.map = null; autocompleteElement?.remove(); };
  }, [apiKey, mapId, name, setValue]);

  return <div className="grid gap-2"><label className="grid gap-1 text-sm font-medium">{label}<div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 z-10 size-4 text-yellow-400"/><div ref={autocompleteHost} className="min-h-11 rounded-lg bg-zinc-900 pl-9 [&_gmp-place-autocomplete]:w-full"/></div></label>{apiKey ? <><div ref={mapElement} className="h-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900" aria-label="Mapa para confirmar la dirección"/><p className="text-xs text-zinc-400">{ready ? "Elegí una sugerencia: aparecerá un pin que podés arrastrar o ajustar con un clic en el mapa." : "Cargando buscador de direcciones…"}</p></> : <p className="text-xs text-amber-300">El buscador de direcciones se habilita al configurar Google Places.</p>}{(loadError || areaError || error) && <p role="alert" className="text-xs text-red-400">{loadError || areaError || error}</p>}</div>;
}
