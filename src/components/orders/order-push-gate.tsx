"use client";

import { useEffect, useState } from "react";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function OrderPushGate({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const response = await fetch("/api/push/subscribe", { cache: "no-store" });
        const payload = await response.json() as { subscribed?: boolean };
        setReady(response.ok && payload.subscribed === true && Notification.permission === "granted");
      } finally {
        setBusy(false);
      }
    }
    void check();
  }, []);

  async function enable() {
    if (!key || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setMessage("Este navegador no permite notificaciones. Abrí Delivery Ya desde un navegador compatible o instalá la app.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Necesitás permitir las notificaciones para pedir un envío.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) });
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error("No pudimos activar las notificaciones. Intentá nuevamente.");
      setReady(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  if (ready) return children;
  return <section className="mt-8 rounded-2xl border border-brand/30 bg-zinc-900 p-6"><p className="font-bold text-brand">NOTIFICACIONES OBLIGATORIAS</p><h2 className="mt-2 text-2xl font-bold">Activá los avisos para solicitar un envío</h2><p className="mt-2 max-w-xl text-sm text-zinc-300">Te notificaremos la confirmación, la asignación del cadete y cada cambio de estado. Sin una suscripción activa no podemos confirmar el pedido.</p><button type="button" onClick={() => void enable()} disabled={busy} className="mt-5 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-brand-foreground disabled:opacity-50">{busy ? "Comprobando..." : "Activar notificaciones"}</button>{message && <p role="alert" className="mt-3 text-sm text-red-300">{message}</p>}</section>;
}
