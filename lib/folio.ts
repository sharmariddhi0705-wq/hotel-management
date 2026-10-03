import { Types, type ClientSession } from "mongoose";
import { calculateFolio, derivePaymentStatus, round2, balanceDue } from "@/lib/pricing";
import { Payment, Reservation, Invoice, type IReservation } from "@/models";

/**
 * Folio (bill) maintenance.
 *
 * `recalculateReservationTotals` is the single writer of every money field on a
 * reservation. Anything that can change the bill — editing dates, adding a
 * charge, taking a payment, issuing a refund — calls it afterwards, so the
 * totals, the payment status and the balance can never disagree with the
 * underlying payment records.
 */

export interface RecalculatedTotals {
  numberOfNights: number;
  roomCharges: number;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  balanceDue: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
}

/** Sums completed payments and refunds recorded against a reservation. */
export async function sumPayments(
  reservationId: Types.ObjectId | string,
  session?: ClientSession | null,
): Promise<{ paid: number; refunded: number; methods: string[] }> {
  const rows = await Payment.aggregate([
    {
      $match: {
        reservation: new Types.ObjectId(String(reservationId)),
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: "$kind",
        total: { $sum: "$amount" },
        methods: { $addToSet: "$method" },
      },
    },
  ]).session(session ?? null);

  let paid = 0;
  let refunded = 0;
  const methods = new Set<string>();

  for (const row of rows) {
    if (row._id === "REFUND") refunded += row.total;
    else paid += row.total;
    for (const m of row.methods ?? []) methods.add(m as string);
  }

  return { paid: round2(paid), refunded: round2(refunded), methods: [...methods] };
}

/**
 * Recomputes and persists every derived amount on a reservation.
 *
 * Returns the new totals so callers can report them without a second read.
 */
export async function recalculateReservationTotals(
  reservationId: Types.ObjectId | string,
  session?: ClientSession | null,
): Promise<RecalculatedTotals> {
  const query = Reservation.findById(reservationId);
  if (session) query.session(session);
  const reservation = await query.exec();
  if (!reservation) {
    throw new Error(`Reservation ${String(reservationId)} disappeared mid-update`);
  }

  const folio = calculateFolio({
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    pricePerNight: reservation.pricePerNight,
    taxPercent: reservation.taxPercent,
    discount: reservation.discount,
    additionalCharges: reservation.additionalCharges.map((c) => ({
      amount: round2(c.amount * (c.quantity || 1)),
    })),
  });

  const { paid, refunded } = await sumPayments(reservation._id, session);

  // Money received minus money given back is what the guest has actually paid.
  const netPaid = round2(Math.max(0, paid - refunded));
  const paymentStatus = derivePaymentStatus(folio.totalAmount, netPaid, refunded);

  reservation.numberOfNights = folio.numberOfNights;
  reservation.roomCharges = folio.roomCharges;
  reservation.subtotal = folio.subtotal;
  reservation.discount = folio.discount;
  reservation.tax = folio.tax;
  reservation.totalAmount = folio.totalAmount;
  reservation.amountPaid = netPaid;
  reservation.amountRefunded = refunded;
  reservation.balanceDue = balanceDue(folio.totalAmount, netPaid);
  reservation.paymentStatus = paymentStatus;

  await reservation.save({ session: session ?? undefined });

  // Keep an already-issued invoice in step with the folio it describes.
  await syncInvoiceWithReservation(reservation, session);

  return {
    numberOfNights: folio.numberOfNights,
    roomCharges: folio.roomCharges,
    subtotal: folio.subtotal,
    discount: folio.discount,
    tax: folio.tax,
    totalAmount: folio.totalAmount,
    amountPaid: netPaid,
    amountRefunded: refunded,
    balanceDue: reservation.balanceDue,
    paymentStatus,
  };
}

/**
 * Mirrors folio amounts onto the reservation's invoice.
 *
 * Only monetary state is synced, never the snapshots: the hotel and guest
 * details on an issued invoice are a historical record and must not drift.
 */
async function syncInvoiceWithReservation(
  reservation: IReservation,
  session?: ClientSession | null,
): Promise<void> {
  const query = Invoice.findOne({ reservation: reservation._id });
  if (session) query.session(session);
  const invoice = await query.exec();
  if (!invoice || invoice.status === "CANCELLED") return;

  const { methods } = await sumPayments(reservation._id, session);

  invoice.roomCharges = reservation.roomCharges;
  invoice.additionalCharges = round2(
    reservation.additionalCharges.reduce(
      (sum, c) => sum + c.amount * (c.quantity || 1),
      0,
    ),
  );
  invoice.subtotal = reservation.subtotal;
  invoice.discount = reservation.discount;
  invoice.taxPercent = reservation.taxPercent;
  invoice.tax = reservation.tax;
  invoice.totalAmount = reservation.totalAmount;
  invoice.amountPaid = reservation.amountPaid;
  invoice.balanceDue = reservation.balanceDue;
  invoice.paymentMethods = methods;
  invoice.lines = buildInvoiceLines(reservation);
  invoice.status =
    reservation.balanceDue <= 0
      ? "PAID"
      : reservation.amountPaid > 0
        ? "PARTIALLY_PAID"
        : "ISSUED";

  await invoice.save({ session: session ?? undefined });
}

/**
 * Line items for an invoice: the room-night block, then each extra charge.
 *
 * Typed structurally rather than as a full `IReservation` so the seed script and
 * the invoice service can both call it without constructing a whole document.
 */
export interface InvoiceLineSource {
  numberOfNights: number;
  pricePerNight: number;
  roomCharges: number;
  additionalCharges: { description: string; amount: number; quantity?: number }[];
}

export function buildInvoiceLines(reservation: InvoiceLineSource) {
  const lines = [
    {
      description: `Room charges — ${reservation.numberOfNights} night(s)`,
      quantity: reservation.numberOfNights,
      unitPrice: reservation.pricePerNight,
      amount: reservation.roomCharges,
    },
  ];

  for (const charge of reservation.additionalCharges) {
    lines.push({
      description: charge.description,
      quantity: charge.quantity || 1,
      unitPrice: charge.amount,
      amount: round2(charge.amount * (charge.quantity || 1)),
    });
  }

  return lines;
}
