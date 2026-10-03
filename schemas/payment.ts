import { z } from "zod";
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
} from "@/lib/constants";
import { moneySchema, objectIdSchema, optionalString, paginationSchema } from "./common";

export const paymentSchema = z.object({
  reservation: objectIdSchema,
  kind: z.enum(PAYMENT_KINDS).default("PAYMENT"),
  amount: moneySchema.refine((v) => v > 0, "Enter an amount greater than zero"),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_RECORD_STATUSES).default("COMPLETED"),
  transactionId: optionalString(120),
  paymentDate: z.coerce.date().default(() => new Date()),
  notes: optionalString(1000),
});

export const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_RECORD_STATUSES).optional(),
  transactionId: optionalString(120),
  notes: optionalString(1000),
});

export const paymentQuerySchema = paginationSchema.extend({
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(PAYMENT_RECORD_STATUSES).optional(),
  kind: z.enum(PAYMENT_KINDS).optional(),
  reservation: objectIdSchema.optional(),
  guest: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const invoiceQuerySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"]).optional(),
  guest: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createInvoiceSchema = z.object({
  reservation: objectIdSchema,
  notes: optionalString(2000),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
