"use client";

import { useEffect, useState } from "react";
import { useRealtimeSubscription } from "@/lib/realtime/subscription";

export function TrackingRealtime({ code, email, onChanged }: { code: string; email: string; onChanged: () => void }) {
  const [channel, setChannel] = useState<string>();
  useEffect(() => {
    let active = true;
    void fetch(`/api/tracking/${encodeURIComponent(code)}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      .then(async (response) => response.ok ? response.json() as Promise<{ channel: string }> : undefined)
      .then((payload) => { if (active) setChannel(payload?.channel); });
    return () => { active = false; };
  }, [code, email]);
  useRealtimeSubscription({ topic: channel ?? "tracking:disabled", event: "tracking.status_changed", onEvent: onChanged, isPrivate: false, enabled: Boolean(channel) });
  return null;
}
