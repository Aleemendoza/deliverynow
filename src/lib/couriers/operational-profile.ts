import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CourierOperationalProfile = {
  id: string;
  is_active: boolean;
  is_online: boolean;
  availability_expires_at: string | null;
  transport_type: "bici" | "moto";
};

export async function getCourierOperationalProfile(profileId: string) {
  const database = getSupabaseServerClient();
  return database
    .from("couriers")
    .select("id,is_active,is_online,availability_expires_at,transport_type")
    .eq("profile_id", profileId)
    .maybeSingle<CourierOperationalProfile>();
}

export function isCourierAvailable(courier: CourierOperationalProfile | null, now = new Date()) {
  return Boolean(
    courier?.is_active
      && courier.is_online
      && courier.availability_expires_at
      && new Date(courier.availability_expires_at) > now,
  );
}
