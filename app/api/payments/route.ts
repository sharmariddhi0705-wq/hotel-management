import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment, Reservation, nextFormattedNumber } from "@/models";
import { paymentQuerySchema, paymentSchema } from "@/schemas/payment";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchPayments } from "@/lib/data";
import { recalculateReservationTotals } from "@/lib/folio";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("payments:view");
    const query = paymentQuerySchema.parse(searchParamsToObject(request));
    const { data, meta, summary } = await fetchPayments(query);
    return ok({ payments: data, summary }, "Payments loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("payments:create");
    const input = paymentSchema.parse(await request.json());

    if (input.kind === "REFUND" && !can(actor.role, "payments:refund")) {
      throw new ForbiddenError("Only a manager or administrator can issue a refund");
    }

    await connectToDatabase();

    const reservation = await Reservation.findById(input.reservation).select(
      "reservationNumber guest reservationStatus totalAmount amountPaid balanceDue",
    );
    if (!reservation) throw new NotFoundError("Reservation");

    if (["CANCELLED", "NO_SHOW"].includes(reservation.reservationStatus) && input.kind === "PAYMENT") {
      throw new ConflictError(
        "This reservation is cancelled. Record a refund instead of a payment.",
      );
    }

    if (input.kind === "REFUND" && input.amount > reservation.amountPaid) {
      throw new ValidationError(
        `Only ${reservation.amountPaid} has been collected, so that refund is too large`,
        { amount: `Cannot refund more than ${reservation.amountPaid}` },
      );
    }

    /**
     * Overpayment is a data-entry mistake far more often than a genuine deposit,
     * so a payment that would take the folio past its total is refused with the
     * exact balance rather than silently accepted.
     */
    if (input.kind === "PAYMENT" && input.status === "COMPLETED") {
      const overpay = round2(input.amount - reservation.balanceDue);
      if (overpay > 0.01) {
        throw new ValidationError(
          `That is ${overpay} more than the outstanding balance of ${reservation.balanceDue}`,
          { amount: `Outstanding balance is ${reservation.balanceDue}` },
        );
      }
    }

    const payment = await Payment.create({
      paymentId: await nextFormattedNumber(input.kind === "REFUND" ? "REF" : "PAY"),
      reservation: reservation._id,
      guest: reservation.guest,
      kind: input.kind,
      amount: input.amount,
      method: input.method,
      status: input.status,
      transactionId: input.transactionId,
      paymentDate: input.paymentDate,
      notes: input.notes,
      receivedBy: actor.id,
    });

    const totals = await recalculateReservationTotals(reservation._id);

    return created(
      { payment: payment.toObject(), totals },
      input.kind === "REFUND"
        ? `Refund ${payment.paymentId} recorded`
        : `Payment ${payment.paymentId} recorded`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
