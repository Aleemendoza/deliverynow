import { describe, expect, it } from "vitest";
import { deliveryStepSchema, orderDraftSchema, personNameSchema, phoneSchema, serviceStepSchema } from "./schema";

const address = { formattedAddress: "San Martín 123, Villa Constitución", placeId: "place-123", latitude: -33.227, longitude: -60.329, city: "Villa Constitución", province: "Santa Fe", mapConfirmed: true };
const validOrder = { serviceType: "document", product: { fragile: false, requiresPurchaseFunds: false, requiresReceipt: false }, pickup: address, delivery: address, senderName: "Ana Pérez", senderPhone: "+54 9 336 412-3456", recipientName: "Luis Gómez", recipientPhone: "+54 9 336 412-3456", deliverySchedule: "immediate", paymentResponsible: "sender", paymentMethod: "cash", urgent: false, termsAccepted: true, idempotencyKey: "d0bca319-1d0d-4422-a469-0f6684087777" };

describe("order validation", () => {
  it("normalizes names and validates Argentine numbers", () => { expect(personNameSchema.parse("  Ana   Pérez ")).toBe("Ana Pérez"); expect(phoneSchema.safeParse("+54 9 336 412-3456").success).toBe(true); });
  it("rejects placeholder names and unverified addresses", () => { expect(personNameSchema.safeParse("test").success).toBe(false); expect(orderDraftSchema.safeParse({ ...validOrder, pickup: { ...address, placeId: "", mapConfirmed: false } }).success).toBe(false); });
  it("requires product details for a package", () => { expect(orderDraftSchema.safeParse({ ...validOrder, serviceType: "package", product: { fragile: false, requiresPurchaseFunds: false, requiresReceipt: false } }).success).toBe(false); });
  it("requires funds for purchases and a valid slot for scheduled deliveries", () => {
    expect(orderDraftSchema.safeParse({ ...validOrder, serviceType: "purchase", product: { description: "Medicamentos", fragile: false, requiresPurchaseFunds: true, requiresReceipt: true } }).success).toBe(false);
    expect(orderDraftSchema.safeParse({ ...validOrder, serviceType: "purchase", product: { description: "Medicamentos", fragile: false, requiresPurchaseFunds: false, requiresReceipt: true } }).success).toBe(true);
    expect(orderDraftSchema.safeParse({ ...validOrder, deliverySchedule: "scheduled", scheduledDate: "", scheduledSlot: "" }).success).toBe(false);
  });
  it("requires acceptance of the service terms", () => expect(orderDraftSchema.safeParse({ ...validOrder, termsAccepted: false }).success).toBe(false));
  it("validates only the fields that belong to each wizard step", () => {
    expect(serviceStepSchema.safeParse({ serviceType: "document", product: validOrder.product }).success).toBe(true);
    expect(deliveryStepSchema.safeParse({ delivery: address, recipientName: validOrder.recipientName, recipientPhone: validOrder.recipientPhone, deliverySchedule: "immediate", paymentResponsible: "sender" }).success).toBe(true);
  });
});
