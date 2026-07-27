"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CourierAvailabilityLease({ online }: { online: boolean }) {
  const router = useRouter(); const [needed, setNeeded] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { if (!online) return; const timer = window.setTimeout(() => setNeeded(true), 13 * 60_000); return () => window.clearTimeout(timer); }, [online]);
  if (!online) return null;
  const renew = async () => { setBusy(true); setMessage(""); try { const response = await fetch("/api/courier/availability/heartbeat", { method: "POST" }); const payload = await response.json() as { message?: string }; if (!response.ok) throw new Error(payload.message ?? "No pudimos renovar tu disponibilidad."); setNeeded(false); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos renovar tu disponibilidad."); } finally { setBusy(false); } };
  return <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm"><p>{needed ? "¿Seguís disponible? Confirmalo para continuar recibiendo pedidos." : "Tu disponibilidad vence en 15 minutos si no la renovás."}</p><button onClick={() => void renew()} disabled={busy} className="mt-2 rounded-md bg-amber-300 px-3 py-2 font-bold text-black disabled:opacity-50">{busy ? "Renovando…" : "Seguir disponible"}</button>{message && <p role="alert" className="mt-2 text-red-300">{message}</p>}</div>;
}
