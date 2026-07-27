"use client";

import { useEffect, useState } from "react";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4); const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushRegistration({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState(""); const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js"); }, []);
  const enable = async () => { if (!key || !("Notification" in window) || !("serviceWorker" in navigator)) { setMessage("Las notificaciones no están disponibles en este navegador."); return; } const permission = await Notification.requestPermission(); if (permission !== "granted") { setMessage("No autorizaste las notificaciones."); return; } const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) }); const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) }); setMessage(response.ok ? "Notificaciones activadas." : "No se pudo activar las notificaciones."); };
  return <div className={compact ? "mt-3 border-t border-white/10 pt-3" : "mt-5"}><button type="button" onClick={enable} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Activar notificaciones push</button>{message && <p role="status" className="mt-2 text-sm text-zinc-400">{message}</p>}</div>;
}
