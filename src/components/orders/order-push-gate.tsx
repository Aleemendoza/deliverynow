"use client";

import { useEffect, useState } from "react";
import { activateBrowserPush, checkBrowserPush } from "@/lib/notifications/browser-push";

export function OrderPushGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function check() {
      const result = await checkBrowserPush();
      setReady(result.ready);
      setMessage(result.message);
      setBusy(false);
    }
    void check();
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    const result = await activateBrowserPush();
    setReady(result.ready);
    setMessage(result.message);
    setBusy(false);
  }

  if (ready) return children;
  return <section className="mt-8 rounded-2xl border border-brand/30 bg-zinc-900 p-6"><p className="font-bold text-brand">NOTIFICACIONES OBLIGATORIAS</p><h2 className="mt-2 text-2xl font-bold">Activá los avisos para solicitar un envío</h2><p className="mt-2 max-w-xl text-sm text-zinc-300">Te notificaremos la confirmación, la asignación del cadete y cada cambio de estado. Sin una suscripción activa en este dispositivo no podemos confirmar el pedido.</p><button type="button" onClick={() => void enable()} disabled={busy} className="mt-5 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-brand-foreground disabled:opacity-50">{busy ? "Comprobando permiso..." : "Activar notificaciones"}</button>{message && <p role="alert" className="mt-3 text-sm text-red-300">{message}</p>}</section>;
}
