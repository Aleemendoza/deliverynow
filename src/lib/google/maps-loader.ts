const GOOGLE_MAPS_SCRIPT_ID = "delivery-now-google-maps";

type GoogleMapsNamespace = {
  maps: {
    importLibrary(libraryName: "maps" | "places" | "geometry"): Promise<unknown>;
  };
};

declare global {
  interface Window {
    __deliveryNowGoogleMapsInit?: () => void;
    google?: GoogleMapsNamespace;
  }
}

let loaderPromise: Promise<GoogleMapsNamespace> | undefined;

/** Loads Google Maps once, using Google's non-blocking direct-script contract. */
export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    window.__deliveryNowGoogleMapsInit = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps se cargó sin la API esperada."));
      }
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps.")), { once: true });
      return;
    }

    const parameters = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: "__deliveryNowGoogleMapsInit",
      v: "weekly",
      language: "es",
      region: "AR",
    });
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${parameters}`;
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
    document.head.appendChild(script);
  });

  return loaderPromise.catch((error: unknown) => {
    loaderPromise = undefined;
    throw error;
  });
}
