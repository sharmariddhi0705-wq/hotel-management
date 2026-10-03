import { z } from "zod";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RESERVATION_STATUSES,
} from "@/lib/constants";
import {
  moneySchema,
  objectIdSchema,
  optionalString,
  paginationSchema,
  percentSchema,
} from "./common";
import { guestSchema } from "./guest";

const stayDatesShape = {
  checkInDate: z.coerce.date({ message: "Select a check-in date" }),
  checkOutDate: z.coerce.date({ message: "Select a check-out date" }),
};

export const reservationBaseSchema = z.object({
  ...stayDatesShape,
  room: objectIdSchema,
  adults: z.coerce.number().int().min(1, "At least one adult").max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  /** Overrides the room rack rate when the front desk negotiates a price. */
  pricePerNight: moneySchema.optional(),
  taxPercent: percentSchema.optional(),
  discount: moneySchema.default(0),
  specialRequests: optionalString(2000),
  source: optionalString(60),
  preferredPaymentMethod: z.enum(PAYMENT_METHODS).optional(),
  reservationStatus: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
});

/**
 * Creating a reservation either points at an existing guest or carries a new
 * guest profile inline. The wizard step 3 offers both, and requiring exactly
 * one of them here means the route handler never has to guess.
 */
export const createReservationSchema = reservationBaseSchema
  .extend({
    guest: objectIdSchema.optional(),
    newGuest: guestSchema.optional(),
    /** Optional deposit taken at booking time (wizard step 5). */
    initialPayment: z
      .object({
        amount: moneySchema.refine((v) => v > 0, "Enter an amount greater than zero"),
        method: z.enum(PAYMENT_METHODS),
        transactionId: optionalString(120),
        notes: optionalString(500),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.guest) !== Boolean(d.newGuest), {
    message: "Select an existing guest or enter a new one",
    path: ["guest"],
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z
  .object({
    ...stayDatesShape,
    room: objectIdSchema,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20),
    pricePerNight: moneySchema,
    taxPercent: percentSchema,
    discount: moneySchema,
    specialRequests: optionalString(2000),
    source: optionalString(60),
    preferredPaymentMethod: z.enum(PAYMENT_METHODS).optional(),
    reservationStatus: z.enum(RESERVATION_STATUSES).optional(),
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });

export const cancelReservationSchema = z.object({
  cancellationReason: z.string().trim().min(3, "Give a short reason").max(500),
  markNoShow: z.coerce.boolean().default(false),
});

export const additionalChargeSchema = z.object({
  description: z.string().trim().min(2, "Describe the charge").max(160),
  amount: moneySchema.refine((v) => v > 0, "Enter an amount greater than zero"),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
});

export const checkInSchema = z.object({
  reservation: objectIdSchema,
  /** Front desk may move the guest to a different room at arrival. */
  room: objectIdSchema.optional(),
  idType: z.string().trim().min(2, "Record the ID type").max(40),
  idNumber: z.string().trim().min(3, "Record the ID number").max(60),
  idVerified: z.literal(true, { message: "Confirm the guest ID was verified" }),
  notes: optionalString(500),
});

export const checkOutSchema = z.object({
  reservation: objectIdSchema,
  /** Charges added at the desk in the same action as the check-out. */
  additionalCharges: z.array(additionalChargeSchema).default([]),
  discount: moneySchema.optional(),
  settlement: z
    .object({
      amount: moneySchema,
      method: z.enum(PAYMENT_METHODS),
      transactionId: optionalString(120),
      notes: optionalString(500),
    })
    .optional(),
  /** Allows checkout with an outstanding balance (corporate billing, disputes). */
  allowOutstandingBalance: z.coerce.boolean().default(false),
  notes: optionalString(500),
});

export const reservationQuerySchema = paginationSchema.extend({
  reservationStatus: z.enum(RESERVATION_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  guest: objectIdSchema.optional(),
  room: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Front-desk shortcuts for today arrivals, departures and in-house guests. */
  view: z.enum(["all", "arrivals", "departures", "inhouse"]).default("all"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type AdditionalChargeInput = z.infer<typeof additionalChargeSchema>;
