"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Options = { topic: string; event: string; onEvent: () => void; isPrivate?: boolean; enabled?: boolean };

export function realtimeEnabled() {
  return process.env.NEXT_PUBLIC_REALTIME_ENABLED === "true";
}

export function useRealtimeSubscription({ topic, event, onEvent, isPrivate = true, enabled = true }: Options) {
  const callback = useRef(onEvent);
  useEffect(() => { callback.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || !realtimeEnabled()) return;
    const supabase = createSupabaseBrowserClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;
      if (isPrivate && !session) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase.channel(topic, { config: { private: isPrivate } })
        .on("broadcast", { event }, () => callback.current())
        .subscribe((status) => { if (status === "SUBSCRIBED") callback.current(); });
    };

    const refreshOnFocus = () => { if (document.visibilityState === "visible") callback.current(); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    void connect();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", refreshOnFocus);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, event, isPrivate, topic]);
}
