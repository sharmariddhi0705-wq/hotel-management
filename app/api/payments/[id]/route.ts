import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment } from "@/models";
import { updatePaymentSchema } from "@/schemas/payment";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { recalculateReservationTotals } from "@/lib/folio";
import { NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("payments:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const payment = await Payment.findById(id)
      .populate("guest", "firstName lastName email phone")
      .populate("reservation", "reservationNumber checkInDate checkOutDate totalAmount")
      .populate("receivedBy", "name")
      .lean();
    if (!payment) throw new NotFoundError("Payment");

    return ok(payment, "Payment loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Corrects the status or reference of a payment record.
 *
 * The amount and method are immutable: changing them would rewrite history. A
 * wrong amount is corrected by voiding this record (status FAILED) and entering
 * the right one, which leaves both visible in the audit trail.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("payments:create");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updatePaymentSchema.parse(await request.json());

    await connectToDatabase();
    const payment = await Payment.findById(id);
    if (!payment) throw new NotFoundError("Payment");

    Object.assign(payment, input);
    await payment.save();

    // A status change moves money in or out of the folio.
    const totals = await recalculateReservationTotals(payment.reservation);

    return ok({ payment: payment.toObject(), totals }, `Payment ${payment.paymentId} updated`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("payments:delete");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const payment = await Payment.findById(id).select("paymentId reservation");
    if (!payment) throw new NotFoundError("Payment");

    const reservationId = payment.reservation;
    await payment.deleteOne();
    const totals = await recalculateReservationTotals(reservationId);

    return ok({ id, totals }, `Payment ${payment.paymentId} removed`);
  } catch (error) {
    return handleApiError(error);
  }
}
