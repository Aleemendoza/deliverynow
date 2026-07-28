import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { isWithinServiceArea, SERVICE_RADIUS_KM } from "@/lib/service-area";

export const serviceTypeSchema = z.enum(["document", "package", "purchase", "store_pickup", "errand", "other"]);
export const packageSizeSchema = z.enum(["small", "medium", "large"]);
export const paymentResponsibleSchema = z.enum(["sender", "recipient"]);
export const scheduleTypeSchema = z.enum(["immediate", "scheduled"]);

const falseNames = new Set(["test", "aaaa", "asdf", "nombre", "1234"]);
export const personNameSchema = z.string().trim().min(4, "Ingresá al menos 4 caracteres").max(80, "Máximo 80 caracteres").transform((value) => value.replace(/\s+/g, " ")).refine((value) => /^[\p{L}][\p{L}' -]*$/u.test(value), "Usá solo letras, espacios, apóstrofes o guiones").refine((value) => !falseNames.has(value.toLowerCase()), "Ingresá un nombre real");
export const emailSchema = z.string().trim().toLowerCase().max(254).email("Ingresá un correo válido");
export const phoneSchema = z.string().trim().min(7, "Ingresá un teléfono").max(30).refine((value) => Boolean(parsePhoneNumberFromString(value, "AR")?.isValid()), "Ingresá un teléfono válido, por ejemplo +54 9 336 412-3456");

export const addressSchema = z.object({
  formattedAddress: z.string().min(5, "Seleccioná una dirección"),
  placeId: z.string().min(1, "Elegí una dirección de las sugerencias"),
  latitude: z.number().finite().refine((value) => value !== 0, "Confirmá el punto en el mapa"),
  longitude: z.number().finite().refine((value) => value !== 0, "Confirmá el punto en el mapa"),
  city: z.string().min(2, "Falta la localidad"), province: z.string().min(2, "Falta la provincia"), postalCode: z.string().optional(),
  streetNumber: z.string().max(20).optional(), floor: z.string().max(20).optional(), apartment: z.string().max(20).optional(),
  reference: z.string().max(300).optional(), mapConfirmed: z.boolean().refine((value) => value, "Confirmá el punto exacto en el mapa"),
}).refine((address) => isWithinServiceArea(address), `La dirección debe estar dentro del radio de ${SERVICE_RADIUS_KM} km de Villa Constitución`);

export const productSchema = z.object({ description: z.string().max(500).optional(), size: packageSizeSchema.optional(), weightKg: z.coerce.number().positive("El peso debe ser mayor a 0").max(15, "El límite inicial es 15 kg").optional(), fragile: z.boolean().default(false), declaredValue: z.coerce.number().min(0).max(500000).optional(), requiresPurchaseFunds: z.boolean().default(false), purchaseFunds: z.coerce.number().positive().max(150000).optional(), requiresReceipt: z.boolean().default(false), notes: z.string().max(1000).optional() });
export const serviceStepSchema = z.object({ serviceType: serviceTypeSchema, product: productSchema }).superRefine((value, context) => { if (["package", "purchase", "store_pickup", "errand", "other"].includes(value.serviceType) && !value.product.description?.trim()) context.addIssue({ code: "custom", path: ["product", "description"], message: "Describí brevemente el pedido" }); if (value.serviceType === "package" && !value.product.size) context.addIssue({ code: "custom", path: ["product", "size"], message: "Elegí un tamaño aproximado" }); if (value.serviceType === "purchase" && value.product.requiresPurchaseFunds && !value.product.purchaseFunds) context.addIssue({ code: "custom", path: ["product", "purchaseFunds"], message: "Indicá el dinero necesario para la compra" }); });
export const pickupStepSchema = z.object({ pickup: addressSchema, senderName: personNameSchema, senderPhone: phoneSchema });
export const deliveryStepSchema = z.object({ delivery: addressSchema, recipientName: personNameSchema, recipientPhone: phoneSchema, deliverySchedule: scheduleTypeSchema, scheduledDate: z.string().optional(), scheduledSlot: z.string().optional(), paymentResponsible: paymentResponsibleSchema }).superRefine((value, context) => { if (value.deliverySchedule === "scheduled") { const date = value.scheduledDate ? new Date(`${value.scheduledDate}T00:00:00`) : undefined; if (!date || Number.isNaN(date.getTime()) || date < new Date(new Date().toDateString())) context.addIssue({ code: "custom", path: ["scheduledDate"], message: "Elegí una fecha futura" }); if (!value.scheduledSlot) context.addIssue({ code: "custom", path: ["scheduledSlot"], message: "Elegí una franja horaria" }); } });
export const confirmationStepSchema = z.object({ paymentMethod: z.enum(["cash", "transfer", "mercado_pago_manual"]), urgent: z.boolean(), termsAccepted: z.boolean().refine((value) => value, "Debés aceptar los términos") });
export const orderDraftSchema = z.object({
  serviceType: serviceTypeSchema, product: productSchema, pickup: addressSchema, delivery: addressSchema,
  senderName: personNameSchema, senderPhone: phoneSchema, recipientName: personNameSchema, recipientPhone: phoneSchema,
  deliverySchedule: scheduleTypeSchema, scheduledDate: z.string().optional(), scheduledSlot: z.string().optional(), paymentResponsible: paymentResponsibleSchema, paymentMethod: z.enum(["cash", "transfer", "mercado_pago_manual"]).default("cash"), urgent: z.boolean().default(false), termsAccepted: z.boolean().refine((value) => value, "Debés aceptar los términos"), idempotencyKey: z.string().uuid(),
}).superRefine((value, context) => {
  const product = value.product;
  if (["package", "purchase", "store_pickup", "errand", "other"].includes(value.serviceType) && !product.description?.trim()) context.addIssue({ code: "custom", path: ["product", "description"], message: "Describí brevemente el pedido" });
  if (value.serviceType === "package" && !product.size) context.addIssue({ code: "custom", path: ["product", "size"], message: "Elegí un tamaño aproximado" });
  if (value.serviceType === "purchase" && product.requiresPurchaseFunds && !product.purchaseFunds) context.addIssue({ code: "custom", path: ["product", "purchaseFunds"], message: "Indicá el dinero necesario para la compra" });
  if (value.deliverySchedule === "scheduled") { const date = value.scheduledDate ? new Date(`${value.scheduledDate}T00:00:00`) : undefined; if (!date || Number.isNaN(date.getTime()) || date < new Date(new Date().toDateString())) context.addIssue({ code: "custom", path: ["scheduledDate"], message: "Elegí una fecha futura" }); if (!value.scheduledSlot) context.addIssue({ code: "custom", path: ["scheduledSlot"], message: "Elegí una franja horaria" }); }
});

export const estimateSchema = z.object({ serviceType: serviceTypeSchema, pickup: addressSchema, delivery: addressSchema, urgent: z.boolean().default(false), product: productSchema.default({ fragile: false, requiresPurchaseFunds: false, requiresReceipt: false }) });

export type OrderDraft = z.input<typeof orderDraftSchema>;
