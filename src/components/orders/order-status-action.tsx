"use client";

import { useState } from "react";
import type { OrderStatus } from "@/types/domain";

const actions: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  confirmed: { status: "assigned", label: "Aceptar pedido" }, assigned: { status: "heading_to_pickup", label: "Iniciar recorrido" }, heading_to_pickup: { status: "at_pickup", label: "Marcar llegada" }, at_pickup: { status: "picked_up", label: "Confirmar retiro" }, picked_up: { status: "heading_to_delivery", label: "Iniciar entrega" }, heading_to_delivery: { status: "at_delivery", label: "Marcar llegada" },
};

export function OrderStatusAction({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [currentStatus, setCurrentStatus] = useState(status); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pin, setPin] = useState("");
  const action = actions[currentStatus];
  const change = async (nextStatus: OrderStatus, deliveryPin?: string) => { setBusy(true); setMessage(""); try { const response = await fetch(`/api/orders/${orderId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, deliveryPin }) }); const payload = await response.json() as { message?: string; status?: OrderStatus }; if (!response.ok || !payload.status) throw new Error(payload.message ?? "No se pudo actualizar el pedido."); setCurrentStatus(payload.status); setPin(""); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar el pedido."); } finally { setBusy(false); } };
  if (currentStatus === "delivered" || currentStatus === "cancelled" || currentStatus === "rejected") return <p className="text-sm text-zinc-400">Pedido {currentStatus.replaceAll("_", " ")}</p>;
  return <div className="mt-3 flex flex-wrap items-center gap-2">{action && <button disabled={busy} onClick={() => change(action.status)} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Actualizando…" : action.label}</button>}{currentStatus === "at_delivery" && <><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="PIN de 6 dígitos" className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"/><button disabled={busy || pin.length !== 6} onClick={() => change("delivered", pin)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Finalizar entrega</button></>}{message && <p role="alert" className="basis-full text-sm text-red-400">{message}</p>}</div>;
}
