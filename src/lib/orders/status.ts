import type { OrderStatus } from "@/types/domain";
const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft:["pending_confirmation"], pending_confirmation:["confirmed","rejected"], confirmed:["assigned","cancelled"], assigned:["heading_to_pickup","cancelled"], heading_to_pickup:["at_pickup","incident","cancelled"], at_pickup:["picked_up","incident","cancelled"], picked_up:["heading_to_delivery","incident"], heading_to_delivery:["at_delivery","incident"], at_delivery:["delivered","incident"], delivered:[], cancelled:[], rejected:[], incident:["assigned","cancelled"]
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => transitions[from].includes(to);
