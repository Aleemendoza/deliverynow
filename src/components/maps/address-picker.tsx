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
type SelectedPlace = {
  id?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  addressComponents?: AddressComponent[];
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};
type PlaceAutocompleteElement = HTMLElement & {
  value?: string;
  placeholder: string;
  includedRegionCodes: string[];
  locationRestriction: { north: number; south: number; east: number; west: number };
};
type PlaceSelectionEvent = Event & { placePrediction: { placeId?: string; toPlace: () => SelectedPlace } };
type LatLng = { lat: () => number; lng: () => number };
type MapInstance = {
  setCenter: (position: Coordinates) => void;
  setZoom: (zoom: number) => void;
  addListener: (eventName: "click", callback: (event: { latLng?: LatLng }) => void) => void;
};
type MarkerInstance = {
  setPosition: (position: Coordinates) => void;
  addListener: (eventName: "dragend", callback: (event: { latLng?: LatLng }) => void) => void;
};
type Props = {
  name: AddressKey;
  label: string;
  setValue: UseFormSetValue<OrderDraft>;
  value?: string;
  error?: string;
};

const mapCenter: Coordinates = {
  lat: VILLA_CONSTITUCION_CENTER.latitude,
  lng: VILLA_CONSTITUCION_CENTER.longitude,
};

export function AddressPicker({ name, label, setValue, value, error }: Props) {
  const autocompleteHost = useRef<HTMLDivElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [areaError, setAreaError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !autocompleteHost.current) return;

    let cancelled = false;
    let autocompleteElement: PlaceAutocompleteElement | undefined;

    const initialize = async () => {
      try {
        const google = await loadGoogleMaps(apiKey);
        const mapsLibrary = await google.maps.importLibrary("maps") as {
          Map: new (element: HTMLDivElement, options: object) => MapInstance;
        };
        const markerLibrary = await google.maps.importLibrary("marker") as {
          Marker: new (options: { draggable: boolean; position: Coordinates; map: MapInstance }) => MarkerInstance;
        };
        const placesLibrary = await google.maps.importLibrary("places") as {
          PlaceAutocompleteElement: new () => PlaceAutocompleteElement;
        };

        if (cancelled || !autocompleteHost.current) return;

        const map = mapElement.current
          ? new mapsLibrary.Map(mapElement.current, { center: mapCenter, zoom: 12, disableDefaultUI: true, zoomControl: true })
          : undefined;
        const latitudeDelta = SERVICE_RADIUS_KM / 111;
        const longitudeDelta = SERVICE_RADIUS_KM / (111 * Math.cos(mapCenter.lat * Math.PI / 180));
        autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
        autocompleteElement.placeholder = "Buscá calle y altura";
        autocompleteElement.value = value ?? "";
        autocompleteElement.includedRegionCodes = ["ar"];
        autocompleteElement.locationRestriction = {
          north: mapCenter.lat + latitudeDelta,
          south: mapCenter.lat - latitudeDelta,
          east: mapCenter.lng + longitudeDelta,
          west: mapCenter.lng - longitudeDelta,
        };
        autocompleteHost.current.replaceChildren(autocompleteElement);

        let marker: MarkerInstance | undefined;
        let selectedAddress = false;
        let lastValidPosition: Coordinates | undefined;

        const coordinatesFromLatLng = (location?: LatLng): Coordinates | undefined => {
          const lat = location?.lat();
          const lng = location?.lng();
          if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) return undefined;
          return { lat, lng };
        };

        const updateMarkerPosition = (position: Coordinates) => {
          const coordinates = { latitude: position.lat, longitude: position.lng };
          if (!isWithinServiceArea(coordinates)) {
            setAreaError(`Este punto está a ${distanceInKm(VILLA_CONSTITUCION_CENTER, coordinates).toFixed(1)} km. Por ahora Delivery Now cubre hasta ${SERVICE_RADIUS_KM} km desde Villa Constitución.`);
            setValue(`${name}.mapConfirmed`, false, { shouldValidate: true });
            if (marker && lastValidPosition) marker.setPosition(lastValidPosition);
            return;
          }

          lastValidPosition = position;
          setAreaError("");
          setValue(`${name}.latitude`, position.lat, { shouldValidate: true });
          setValue(`${name}.longitude`, position.lng, { shouldValidate: true });
          setValue(`${name}.mapConfirmed`, true, { shouldValidate: true });

          try {
            if (marker) marker.setPosition(position);
            else if (map) {
              marker = new markerLibrary.Marker({ draggable: true, position, map });
              marker.addListener("dragend", (event) => {
                const draggedPosition = coordinatesFromLatLng(event.latLng);
                if (draggedPosition) updateMarkerPosition(draggedPosition);
              });
            }
          } catch (markerError) {
            // The selected address remains valid even if Maps cannot render its marker.
            console.error("No se pudo mostrar el marcador de la dirección seleccionada.", markerError);
          }
        };

        map?.addListener("click", (event) => {
          if (!selectedAddress) {
            setAreaError("Primero elegí una dirección sugerida; después podés ajustar el marcador en el mapa.");
            return;
          }

          const position = coordinatesFromLatLng(event.latLng);
          if (position) updateMarkerPosition(position);
        });

        autocompleteElement.addEventListener("gmp-select", async (event) => {
          try {
            const prediction = (event as PlaceSelectionEvent).placePrediction;
            const place = prediction?.toPlace();
            if (!place) return;

            await place.fetchFields({ fields: ["id", "formattedAddress", "location", "addressComponents"] });
            const location = place.location;
            const latitude = location?.lat();
            const longitude = location?.lng();
            if (typeof latitude !== "number" || !Number.isFinite(latitude) || typeof longitude !== "number" || !Number.isFinite(longitude)) {
              setAreaError("No pudimos obtener coordenadas válidas para esa dirección. Elegí otra sugerencia.");
              return;
            }

            const coordinates = { latitude, longitude };
            if (!isWithinServiceArea(coordinates)) {
              setAreaError(`Esta dirección está a ${distanceInKm(VILLA_CONSTITUCION_CENTER, coordinates).toFixed(1)} km. Por ahora Delivery Now cubre hasta ${SERVICE_RADIUS_KM} km desde Villa Constitución.`);
              setValue(`${name}.mapConfirmed`, false, { shouldValidate: true });
              return;
            }

            const mapCoordinates = { lat: latitude, lng: longitude };
            map?.setCenter(mapCoordinates);
            map?.setZoom(16);

            const part = (type: string) => place.addressComponents?.find((component) => component.types?.includes(type))?.longText ?? "";
            const formattedAddress = place.formattedAddress ?? "";
            const placeId = place.id ?? prediction.placeId ?? "";
            if (!formattedAddress || !placeId) {
              setAreaError("Google no devolvió todos los datos para confirmar esta dirección. Elegí otra sugerencia.");
              setValue(`${name}.mapConfirmed`, false, { shouldValidate: true });
              return;
            }

            setValue(`${name}.formattedAddress`, formattedAddress, { shouldValidate: true });
            setValue(`${name}.placeId`, placeId, { shouldValidate: true });
            setValue(`${name}.city`, part("locality") || part("administrative_area_level_2"), { shouldValidate: true });
            setValue(`${name}.province`, part("administrative_area_level_1"), { shouldValidate: true });
            setValue(`${name}.postalCode`, part("postal_code"));
            setValue(`${name}.streetNumber`, part("street_number"));
            selectedAddress = true;
            updateMarkerPosition(mapCoordinates);
          } catch (selectionError) {
            console.error("No se pudo confirmar la dirección seleccionada.", selectionError);
            setAreaError("No pudimos confirmar esa dirección. Intentá seleccionar otra sugerencia.");
            setValue(`${name}.mapConfirmed`, false, { shouldValidate: true });
          }
        });

        setReady(true);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar el buscador de direcciones. Revisá la configuración de Google Maps.");
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      autocompleteElement?.remove();
    };
  }, [apiKey, name, setValue, value]);

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium">
        {label}
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-3.5 z-10 size-4 text-yellow-400" />
          <div ref={autocompleteHost} className="min-h-11 rounded-lg bg-zinc-900 pl-9 [&_gmp-place-autocomplete]:w-full" />
        </div>
      </label>
      {apiKey ? <>
        <div ref={mapElement} className="h-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900" aria-label="Mapa para confirmar la dirección" />
        <p className="text-xs text-zinc-400">{ready ? `Seleccioná una sugerencia y ajustá el marcador con un clic o arrastrándolo. Cobertura: hasta ${SERVICE_RADIUS_KM} km desde Villa Constitución.` : "Cargando buscador de direcciones…"}</p>
      </> : <p className="text-xs text-amber-300">El buscador de direcciones se habilita al configurar Google Places.</p>}
      {(loadError || areaError || error) && <p role="alert" className="text-xs text-red-400">{loadError || areaError || error}</p>}
    </div>
  );
}
