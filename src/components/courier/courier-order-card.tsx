import { MapPin, Navigation, Phone, ReceiptText, ShieldAlert } from "lucide-react";
import { OrderStatusAction } from "@/components/orders/order-status-action";
import type { OrderStatus } from "@/types/domain";

type Stop = { type: "pickup" | "delivery"; contact_name: string; contact_phone_e164: string; instructions: string | null; arrived_at: string | null; completed_at: string | null; addresses: { formatted_address: string; latitude: number; longitude: number; floor: string | null; apartment: string | null; reference: string | null } | null };
type History = { new_status: OrderStatus; created_at: string; reason: string | null };

export type CourierOrder = { id: string; tracking_code: string; status: OrderStatus; created_at: string; scheduled_at: string | null; completed_at: string | null; estimated_price: number | null; final_price: number | null; distance_meters: number | null; duration_seconds: number | null; payment_responsible: string; payment_method: string | null; notes: string | null; service_types: { name: string } | null; order_stops: Stop[]; order_status_history: History[] };

const statusLabel: Record<OrderStatus, string> = { draft: "Borrador", pending_confirmation: "Pendiente", confirmed: "Disponible", assigned: "Asignado", heading_to_pickup: "En camino al retiro", at_pickup: "En retiro", picked_up: "Retirado", heading_to_delivery: "En camino a entregar", at_delivery: "En destino", delivered: "Entregado", cancelled: "Cancelado", rejected: "Rechazado", incident: "Incidencia" };
const statusStyle: Partial<Record<OrderStatus, string>> = { confirmed: "bg-sky-400/15 text-sky-300", delivered: "bg-emerald-400/15 text-emerald-300", incident: "bg-red-400/15 text-red-300", cancelled: "bg-zinc-700 text-zinc-300" };
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sin horario programado";
const elapsed = (seconds: number | null) => seconds ? `${Math.max(1, Math.round(seconds / 60))} min estimados` : "Tiempo a confirmar";

export function CourierOrderCard({ order, showHistory = false }: { order: CourierOrder; showHistory?: boolean }) {
  const pickup = order.order_stops.find((stop) => stop.type === "pickup");
  const delivery = order.order_stops.find((stop) => stop.type === "delivery");
  const stops = [pickup, delivery].filter((stop): stop is Stop => Boolean(stop));
  const mapsUrl = pickup?.addresses && delivery?.addresses ? `https://www.google.com/maps/dir/?api=1&origin=${pickup.addresses.latitude},${pickup.addresses.longitude}&destination=${delivery.addresses.latitude},${delivery.addresses.longitude}` : null;
  const isClosed = ["delivered", "cancelled", "rejected"].includes(order.status);

  return <article className="rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="break-words text-sm font-bold text-brand">{order.tracking_code}</p><h2 className="mt-1 break-words text-lg font-bold">{order.service_types?.name ?? "Envío"}</h2><p className="mt-1 text-sm text-zinc-400">{dateTime(order.scheduled_at ?? order.created_at)}</p></div>
      <div className="w-full sm:w-auto sm:text-right"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyle[order.status] ?? "bg-brand/15 text-brand"}`}>{statusLabel[order.status]}</span><p className="mt-2 font-bold text-brand">${Number(order.final_price ?? order.estimated_price ?? 0).toLocaleString("es-AR")}</p></div>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {stops.map((stop, index) => <section className="rounded-xl bg-zinc-800/80 p-4" key={stop.type}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-400"><MapPin className={index === 0 ? "size-4 text-brand" : "size-4 text-emerald-400"}/>{index === 0 ? "Retiro" : "Entrega"}</p>
        <p className="mt-2 break-words font-semibold">{stop.addresses?.formatted_address ?? "Dirección no disponible"}</p>
        {(stop.addresses?.floor || stop.addresses?.apartment || stop.addresses?.reference || stop.instructions) && <p className="mt-1 text-sm text-zinc-400">{[stop.addresses?.floor && `Piso ${stop.addresses.floor}`, stop.addresses?.apartment && `Dto. ${stop.addresses.apartment}`, stop.addresses?.reference, stop.instructions].filter(Boolean).join(" · ")}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-words">{stop.contact_name}</span><a className="inline-flex shrink-0 items-center gap-1 text-brand" href={`tel:${stop.contact_phone_e164}`}><Phone className="size-3.5"/>Llamar</a></div>
        {(stop.arrived_at || stop.completed_at) && <p className="mt-2 text-xs text-zinc-500">{stop.completed_at ? `Completado ${dateTime(stop.completed_at)}` : `Llegada ${dateTime(stop.arrived_at)}`}</p>}
      </section>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400"><span>{order.distance_meters ? `${(order.distance_meters / 1000).toFixed(1)} km` : "Distancia a confirmar"}</span><span>{elapsed(order.duration_seconds)}</span><span>Abona: {order.payment_responsible === "sender" ? "remitente" : "destinatario"}{order.payment_method ? ` · ${order.payment_method.replaceAll("_", " ")}` : ""}</span></div>
    {order.notes && <p className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm text-zinc-200"><ReceiptText className="mr-2 inline size-4 text-brand"/>{order.notes}</p>}
    {!isClosed && <div className="mt-5 flex flex-wrap items-center gap-3"><OrderStatusAction orderId={order.id} status={order.status}/>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold"><Navigation className="size-4"/>Abrir ruta</a>}</div>}
    {showHistory && <div className="mt-5 border-t border-white/10 pt-4"><p className="text-sm font-bold">Historial del pedido</p><ol className="mt-3 grid gap-2">{order.order_status_history.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map((event, index) => <li className="flex gap-3 text-sm" key={`${event.created_at}-${index}`}><span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"/><span><b>{statusLabel[event.new_status]}</b><span className="text-zinc-400"> · {dateTime(event.created_at)}{event.reason ? ` · ${event.reason}` : ""}</span></span></li>)}</ol></div>}
    {order.status === "incident" && <p className="mt-4 flex items-center gap-2 text-sm text-red-300"><ShieldAlert className="size-4"/>Este pedido requiere seguimiento de coordinación.</p>}
  </article>;
}
