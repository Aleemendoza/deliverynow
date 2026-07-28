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
      setReady(result.ready); setMessage(result.message); setBusy(false);
    }
    void check();
  }, []);

  async function enable() {
    setBusy(true); setMessage("");
    const result = await activateBrowserPush();
    setReady(result.ready); setMessage(result.message); setBusy(false);
  }

  return <>{!ready && <aside className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-4 sm:p-5"><p className="font-bold text-brand">Avisos de tu pedido</p><p className="mt-2 text-sm text-zinc-300">Podés activar notificaciones para recibir cambios de estado al instante. Si no se activan ahora, igual podés solicitar tu envío y seguirlo desde la app.</p><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void enable()} disabled={busy} className="rounded-lg border border-brand/50 px-4 py-2 text-sm font-bold text-brand transition hover:bg-brand/10 disabled:opacity-50">{busy ? "Comprobando notificaciones…" : "Activar notificaciones"}</button>{message && <p role="status" className="text-sm text-zinc-400">{message}</p>}</div></aside>}{children}</>;
}
