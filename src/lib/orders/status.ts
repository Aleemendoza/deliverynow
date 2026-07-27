import type { OrderStatus } from "@/types/domain";
const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft:["pending_confirmation"], pending_confirmation:["confirmed","rejected"], confirmed:["assigned","cancelled"], assigned:["heading_to_pickup","cancelled"], heading_to_pickup:["at_pickup","incident","cancelled"], at_pickup:["picked_up","incident","cancelled"], picked_up:["heading_to_delivery","incident"], heading_to_delivery:["at_delivery","incident"], at_delivery:["delivered","incident"], delivered:[], cancelled:[], rejected:[], incident:["assigned","cancelled"]
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => transitions[from].includes(to);

export const orderStatusLabel: Record<OrderStatus, string> = {
  draft: "Borrador",
  pending_confirmation: "Solicitud recibida",
  confirmed: "Confirmado · buscando cadete",
  assigned: "Cadete asignado",
  heading_to_pickup: "Cadete en camino al retiro",
  at_pickup: "Cadete en el punto de retiro",
  picked_up: "Pedido retirado",
  heading_to_delivery: "Cadete en camino a la entrega",
  at_delivery: "Cadete en el destino",
  delivered: "Pedido entregado",
  cancelled: "Pedido cancelado",
  rejected: "Solicitud rechazada",
  incident: "Pedido con incidencia",
};

export function humanizeOrderStatus(status: string) {
  return orderStatusLabel[status as OrderStatus] ?? status.replaceAll("_", " ");
}
