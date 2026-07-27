"use client";

import { useEffect, useState } from "react";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function withTimeout<T>(promise: Promise<T>, message: string, milliseconds = 12_000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), milliseconds)),
  ]);
}

export function OrderPushGate({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function check() {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
        await withTimeout(navigator.serviceWorker.register("/sw.js"), "No se pudo preparar las notificaciones.");
        const response = await withTimeout(fetch("/api/push/subscribe", { cache: "no-store" }), "La comprobación de notificaciones tardó demasiado.");
        const payload = await response.json() as { subscribed?: boolean };
        setReady(response.ok && payload.subscribed === true && Notification.permission === "granted");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo comprobar las notificaciones.");
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
      const permission = await withTimeout(Notification.requestPermission(), "El navegador no respondió al permiso de notificaciones.");
      if (permission !== "granted") throw new Error("Necesitás permitir las notificaciones para pedir un envío.");
      const registration = await withTimeout(navigator.serviceWorker.register("/sw.js"), "No se pudo registrar el servicio de notificaciones.");
      const subscription = await withTimeout(registration.pushManager.getSubscription(), "No se pudo consultar la suscripción push.") ?? await withTimeout(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) }), "La suscripción push tardó demasiado.");
      const response = await withTimeout(fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) }), "No se pudo guardar la suscripción push.");
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
