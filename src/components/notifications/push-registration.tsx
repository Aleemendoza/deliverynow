"use client";

import { useEffect, useState } from "react";
import { activateBrowserPush, checkBrowserPush } from "@/lib/notifications/browser-push";

export function PushRegistration({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);

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
    const result = await activateBrowserPush();
    setReady(result.ready);
    setMessage(result.message);
    setBusy(false);
  }

  return <div className={compact ? "mt-3 border-t border-white/10 pt-3" : "mt-5"}>{ready ? <p role="status" className="text-sm text-emerald-300">Notificaciones push activas.</p> : <><button type="button" onClick={() => void enable()} disabled={busy} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-50">{busy ? "Comprobando permiso..." : "Activar notificaciones push"}</button>{message && <p role="status" className="mt-2 text-sm text-zinc-400">{message}</p>}</>}</div>;
}
