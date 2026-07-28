"use client";

import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";

export type PushCheck = {
  ready: boolean;
  message: string;
};

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

function supportError() {
  if (!window.isSecureContext) return "Las notificaciones requieren una conexión segura (HTTPS).";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "Este navegador no admite notificaciones push. Abrí Delivery Ya en un navegador compatible.";
  return null;
}

function permissionError() {
  if (Notification.permission === "denied") return "El navegador bloqueó las notificaciones. Habilitalas desde el ícono de controles del sitio junto a la dirección y volvé a intentar. En incógnito pueden estar bloqueadas por el navegador.";
  return "Necesitás aceptar el permiso que muestra el navegador para recibir avisos.";
}

async function registration() {
  await withTimeout(navigator.serviceWorker.register("/sw.js"), "No se pudo preparar el servicio de notificaciones.");
  return withTimeout(navigator.serviceWorker.ready, "El servicio de notificaciones no respondió.");
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await withTimeout(authenticatedFetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  }), "No se pudo vincular este dispositivo a las notificaciones.");
  if (response.ok) return;

  const payload = await response.json().catch(() => null) as { message?: string } | null;
  throw new Error(payload?.message ?? "No se pudo guardar la suscripción push.");
}

export async function checkBrowserPush(): Promise<PushCheck> {
  const unsupported = supportError();
  if (unsupported) return { ready: false, message: unsupported };
  if (Notification.permission !== "granted") return { ready: false, message: permissionError() };

  try {
    const worker = await registration();
    const subscription = await withTimeout(worker.pushManager.getSubscription(), "No se pudo comprobar la suscripción push.");
    if (!subscription) return { ready: false, message: "El permiso está concedido, pero este dispositivo todavía no está suscripto. Activá las notificaciones para vincularlo." };
    await saveSubscription(subscription);
    return { ready: true, message: "" };
  } catch (error) {
    return { ready: false, message: error instanceof Error ? error.message : "No se pudo comprobar la suscripción push." };
  }
}

export async function activateBrowserPush(): Promise<PushCheck> {
  const unsupported = supportError();
  if (unsupported) return { ready: false, message: unsupported };

  try {
    const permission = Notification.permission === "default"
      ? await withTimeout(Notification.requestPermission(), "El navegador no respondió al permiso de notificaciones.")
      : Notification.permission;
    if (permission !== "granted") return { ready: false, message: permissionError() };

    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return { ready: false, message: "Las notificaciones todavía no están configuradas en el servidor." };
    const worker = await registration();
    const existing = await withTimeout(worker.pushManager.getSubscription(), "No se pudo consultar la suscripción push.");
    const subscription = existing ?? await withTimeout(
      worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) }),
      "La suscripción push tardó demasiado.",
    );
    await saveSubscription(subscription);
    return { ready: true, message: "Notificaciones activadas para este dispositivo." };
  } catch (error) {
    return { ready: false, message: error instanceof Error ? error.message : "No pudimos activar las notificaciones." };
  }
}
