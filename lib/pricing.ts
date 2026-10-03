import { nightsBetween } from "@/lib/dates";

/**
 * Money and billing arithmetic.
 *
 * All amounts are stored as numbers in the hotel's base currency with two
 * decimal places. Every computed amount goes through `round2` so repeated
 * float operations cannot drift a bill by a fraction of a paisa.
 */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface FolioInput {
  checkInDate: Date | string;
  checkOutDate: Date | string;
  pricePerNight: number;
  taxPercent: number;
  discount?: number;
  additionalCharges?: { amount: number }[];
}

export interface FolioTotals {
  numberOfNights: number;
  roomCharges: number;
  additionalCharges: number;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  tax: number;
  totalAmount: number;
}

/**
 * Computes a folio from first principles.
 *
 * Order of operations matters for the guest's bill: the discount is applied to
 * the subtotal *before* tax, so tax is charged on what the guest actually pays.
 */
export function calculateFolio(input: FolioInput): FolioTotals {
  const numberOfNights = Math.max(
    1,
    nightsBetween(input.checkInDate, input.checkOutDate),
  );
  const roomCharges = round2(numberOfNights * input.pricePerNight);
  const additionalCharges = round2(
    (input.additionalCharges ?? []).reduce((sum, c) => sum + (c.amount || 0), 0),
  );
  const subtotal = round2(roomCharges + additionalCharges);
  const discount = round2(Math.min(input.discount ?? 0, subtotal));
  const taxableAmount = round2(subtotal - discount);
  const tax = round2((taxableAmount * input.taxPercent) / 100);
  const totalAmount = round2(taxableAmount + tax);

  return {
    numberOfNights,
    roomCharges,
    additionalCharges,
    subtotal,
    discount,
    taxableAmount,
    tax,
    totalAmount,
  };
}

/**
 * Derives the payment status from money actually received.
 *
 * This is the only place that decides "PAID", which is what keeps the rule
 * "never fully paid unless paid >= total" true everywhere.
 */
export function derivePaymentStatus(
  totalAmount: number,
  amountPaid: number,
  refunded = 0,
): "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED" {
  const paid = round2(amountPaid);
  const total = round2(totalAmount);

  if (refunded > 0 && paid <= 0) return "REFUNDED";
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

export function balanceDue(totalAmount: number, amountPaid: number): number {
  return round2(Math.max(0, totalAmount - amountPaid));
}
