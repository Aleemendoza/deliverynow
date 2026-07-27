"use client";

import { useEffect, useState } from "react";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushRegistration({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);

  async function enable() {
    if (!key || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setMessage("Las notificaciones no están disponibles en este navegador.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Necesitás permitir las notificaciones.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) });
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error("No se pudo guardar la suscripción push.");
      setMessage("Notificaciones activadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={compact ? "mt-3 border-t border-white/10 pt-3" : "mt-5"}><button type="button" onClick={() => void enable()} disabled={busy} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-50">{busy ? "Activando..." : "Activar notificaciones push"}</button>{message && <p role="status" className="mt-2 text-sm text-zinc-400">{message}</p>}</div>;
}
