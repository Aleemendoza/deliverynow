"use client";

import { CourierAvailabilityLease } from "@/components/courier/courier-availability-lease";
import { CourierPresence } from "@/components/courier/courier-presence";
import { useCourierAvailability } from "@/components/courier/courier-availability-context";

export function CourierAvailabilityStatus({ hasActiveOrder }: { hasActiveOrder: boolean }) {
  const { online } = useCourierAvailability();
  return <><CourierPresence online={online} hasActiveOrder={hasActiveOrder}/><CourierAvailabilityLease online={online}/></>;
}
