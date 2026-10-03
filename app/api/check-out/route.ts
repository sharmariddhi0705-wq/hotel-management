import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import {
  Guest,
  HousekeepingTask,
  Payment,
  Reservation,
  Room,
  nextFormattedNumber,
} from "@/models";
import { checkOutSchema } from "@/schemas/reservation";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { recalculateReservationTotals } from "@/lib/folio";
import { issueInvoiceForReservation } from "@/lib/invoices";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import { getHotelSettings } from "@/lib/settings";

/**
 * Checks a guest out and closes the folio.
 *
 * Sequence:
 *  1. only a CHECKED_IN reservation can be checked out,
 *  2. post any last-minute charges and discount, then recompute the folio,
 *  3. record the settlement payment, then recompute again,
 *  4. refuse if a balance remains, unless the desk explicitly allows it,
 *  5. mark the reservation CHECKED_OUT and the room CLEANING,
 *  6. raise a housekeeping task and issue the invoice.
 *
 * Steps 2–4 run in that order because the balance check must see both the new
 * charges and the payment that settles them.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("checkout:manage");
    const input = checkOutSchema.parse(await request.json());

    await connectToDatabase();
    const settings = await getHotelSettings();

    const reservation = await Reservation.findById(input.reservation);
    if (!reservation) throw new NotFoundError("Reservation");

    if (reservation.reservationStatus !== "CHECKED_IN") {
      throw new ConflictError(
        reservation.reservationStatus === "CHECKED_OUT"
          ? `Reservation ${reservation.reservationNumber} is already checked out`
          : "Only a checked-in reservation can be checked out",
      );
    }

    // 2. Last-minute charges and any discount agreed at the desk.
    for (const charge of input.additionalCharges) {
      reservation.additionalCharges.push({
        description: charge.description,
        amount: charge.amount,
        quantity: charge.quantity,
        addedAt: new Date(),
        addedBy: new Types.ObjectId(actor.id),
      });
    }
    if (input.discount !== undefined) {
      reservation.discount = input.discount;
    }
    if (input.additionalCharges.length > 0 || input.discount !== undefined) {
      await reservation.save();
      await recalculateReservationTotals(reservation._id);
    }

    // 3. Settlement payment.
    if (input.settlement && input.settlement.amount > 0) {
      await Payment.create({
        paymentId: await nextFormattedNumber("PAY"),
        reservation: reservation._id,
        guest: reservation.guest,
        kind: "PAYMENT",
        amount: input.settlement.amount,
        method: input.settlement.method,
        status: "COMPLETED",
        transactionId: input.settlement.transactionId,
        notes: input.settlement.notes ?? "Settlement at check-out",
        paymentDate: new Date(),
        receivedBy: actor.id,
      });
    }

    const totals = await recalculateReservationTotals(reservation._id);

    // 4. Do not close a stay with money outstanding unless told to.
    if (totals.balanceDue > 0 && !input.allowOutstandingBalance) {
      throw new ValidationError(
        `${formatCurrency(totals.balanceDue, {
          currency: settings.currency,
          locale: settings.locale,
        })} is still outstanding. Take payment, or confirm check-out with a balance.`,
        { settlement: `Outstanding balance: ${totals.balanceDue}` },
      );
    }

    // 5. Close the stay. Re-read so the totals just written are in hand.
    const closing = await Reservation.findById(reservation._id);
    if (!closing) throw new NotFoundError("Reservation");

    closing.reservationStatus = "CHECKED_OUT";
    closing.actualCheckOutTime = new Date();
    closing.checkedOutBy = new Types.ObjectId(actor.id);
    await closing.save();

    /**
     * A vacated room is never immediately sellable: it goes to CLEANING and is
     * marked DIRTY, and housekeeping returns it to AVAILABLE once cleaned.
     */
    const room = await Room.findById(closing.room);
    if (room) {
      room.status = "CLEANING";
      room.housekeepingStatus = "DIRTY";
      await room.save();

      await HousekeepingTask.create({
        taskCode: await nextFormattedNumber("HK"),
        room: room._id,
        reservation: closing._id,
        type: "CLEANING",
        status: "PENDING",
        priority: "HIGH",
        assignedTo: room.assignedHousekeeper ?? null,
        scheduledFor: new Date(),
        notes: `Departure clean after ${closing.reservationNumber}`,
        createdBy: actor.id,
      });
    }

    // 6. Invoice, plus the guest's lifetime counters.
    const invoice = await issueInvoiceForReservation(closing._id, {
      issuedBy: actor.id,
      notes: input.notes,
    });

    await Guest.updateOne(
      { _id: closing.guest },
      { $inc: { totalStays: 1, totalSpend: closing.totalAmount } },
    );

    return ok(
      {
        reservationId: String(closing._id),
        reservationNumber: closing.reservationNumber,
        reservationStatus: closing.reservationStatus,
        roomNumber: room?.roomNumber ?? null,
        roomStatus: room?.status ?? null,
        actualCheckOutTime: closing.actualCheckOutTime,
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        totals,
      },
      `Checked out. Invoice ${invoice.invoiceNumber} generated.`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
