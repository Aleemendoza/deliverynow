"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/auth/authenticated-fetch";
import { useCourierAvailability } from "@/components/courier/courier-availability-context";

export function CourierAvailabilityToggle() {
  const router = useRouter();
  const { online, setOnline } = useCourierAvailability();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleAvailability() {
    const nextOnline = !online;
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/courier/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: nextOnline }),
      });
      const payload = await response.json() as { message?: string; isOnline?: boolean };
      if (!response.ok || typeof payload.isOnline !== "boolean") throw new Error(payload.message ?? "No se pudo actualizar tu disponibilidad.");
      setOnline(payload.isOnline);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar tu disponibilidad.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={toggleAvailability} disabled={busy} aria-pressed={online} className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${online ? "bg-emerald-400 text-slate-950" : "bg-zinc-800 text-white"}`}>
      <span className={`mr-2 inline-block size-2 rounded-full ${online ? "bg-emerald-950" : "bg-zinc-500"}`} />
      {busy ? "Actualizando…" : online ? "Disponible" : "No disponible"}
    </button>
    {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
  </div>;
}
