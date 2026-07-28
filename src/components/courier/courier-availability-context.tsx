"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CourierAvailabilityContextValue = {
  online: boolean;
  setOnline: (online: boolean) => void;
  markUnavailable: () => void;
};

const CourierAvailabilityContext = createContext<CourierAvailabilityContextValue | null>(null);

export function CourierAvailabilityProvider({ initialOnline, children }: { initialOnline: boolean; children: ReactNode }) {
  const [online, setOnline] = useState(initialOnline);
  return <CourierAvailabilityContext.Provider value={{ online, setOnline, markUnavailable: () => setOnline(false) }}>{children}</CourierAvailabilityContext.Provider>;
}

export function useCourierAvailability() {
  const context = useContext(CourierAvailabilityContext);
  if (!context) throw new Error("useCourierAvailability debe usarse dentro de CourierAvailabilityProvider.");
  return context;
}
