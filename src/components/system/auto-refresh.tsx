"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const interval = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, router]);
  return null;
}
