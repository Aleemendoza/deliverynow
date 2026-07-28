"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus } from "@/types/domain";

const actions: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  confirmed: { status: "assigned", label: "Aceptar pedido" },
  assigned: { status: "heading_to_pickup", label: "Iniciar recorrido" },
  heading_to_pickup: { status: "at_pickup", label: "Marcar llegada" },
  picked_up: { status: "heading_to_delivery", label: "Iniciar entrega" },
  heading_to_delivery: { status: "at_delivery", label: "Marcar llegada" },
};

export function OrderStatusAction({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [incidentReason, setIncidentReason] = useState("");
  const [reportingIncident, setReportingIncident] = useState(false);
  const action = actions[currentStatus];

  const change = async (nextStatus: OrderStatus, pickupConfirmation?: boolean, reason?: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, pickupConfirmed: pickupConfirmation, reason }),
      });
      const payload = await response.json() as { message?: string; status?: OrderStatus };
      if (!response.ok || !payload.status) throw new Error(payload.message ?? "No se pudo actualizar el pedido.");
      setCurrentStatus(payload.status);
      setPickupConfirmed(false);
      setIncidentReason("");
      setReportingIncident(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    } finally {
      setBusy(false);
    }
  };

  if (["delivered", "cancelled", "rejected"].includes(currentStatus)) {
    return <p className="text-sm text-zinc-400">Pedido {currentStatus.replaceAll("_", " ")}</p>;
  }

  const canReportIncident = ["heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery"].includes(currentStatus);
  return <div className="mt-3 flex flex-wrap items-center gap-2">
    {action && <button disabled={busy} onClick={() => change(action.status)} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Actualizando…" : action.label}</button>}
    {currentStatus === "at_pickup" && <div className="basis-full rounded-lg border border-white/10 bg-zinc-800 p-3">
      <label className="flex items-start gap-2 text-sm"><input checked={pickupConfirmed} onChange={(event) => setPickupConfirmed(event.target.checked)} type="checkbox" className="mt-1"/>Confirmo que retiré el pedido y que coincide con lo informado por el cliente.</label>
      <button disabled={busy || !pickupConfirmed} onClick={() => change("picked_up", pickupConfirmed)} className="mt-3 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Actualizando…" : "Confirmar retiro"}</button>
    </div>}
    {currentStatus === "at_delivery" && <button disabled={busy} onClick={() => change("delivered")} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Actualizando…" : "Finalizar entrega"}</button>}
    {canReportIncident && <div className="basis-full">
      <button type="button" onClick={() => setReportingIncident((value) => !value)} className="text-sm text-red-300 underline underline-offset-4">Reportar incidencia</button>
      {reportingIncident && <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
        <input value={incidentReason} onChange={(event) => setIncidentReason(event.target.value)} maxLength={500} placeholder="Describí qué ocurrió" className="min-w-52 flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm"/>
        <button disabled={busy || incidentReason.trim().length < 5} onClick={() => change("incident", undefined, incidentReason.trim())} className="rounded-lg bg-red-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Enviar reporte</button>
      </div>}
    </div>}
    {message && <p role="alert" className="basis-full text-sm text-red-400">{message}</p>}
  </div>;
}
