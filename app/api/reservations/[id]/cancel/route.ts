import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Invoice, Reservation } from "@/models";
import { cancelReservationSchema } from "@/schemas/reservation";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { releaseRoomIfUnused } from "@/lib/rooms";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Cancels a reservation (or marks it a no-show).
 *
 * Cancelling frees the dates immediately: the status leaves the blocking set, so
 * the availability query stops counting it. Any money already taken is left
 * alone — refunds are recorded explicitly through /api/payments so the audit
 * trail shows who returned what.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("reservations:cancel");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = cancelReservationSchema.parse(await request.json());

    await connectToDatabase();
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new NotFoundError("Reservation");

    if (reservation.reservationStatus === "CHECKED_IN") {
      throw new ConflictError(
        "This guest is in house. Check them out instead of cancelling.",
      );
    }
    if (reservation.reservationStatus === "CHECKED_OUT") {
      throw new ConflictError("A completed stay cannot be cancelled");
    }
    if (["CANCELLED", "NO_SHOW"].includes(reservation.reservationStatus)) {
      throw new ConflictError("This reservation is already cancelled");
    }

    const roomId = String(reservation.room);

    reservation.reservationStatus = input.markNoShow ? "NO_SHOW" : "CANCELLED";
    reservation.cancelledAt = new Date();
    reservation.cancelledBy = new Types.ObjectId(actor.id);
    reservation.cancellationReason = input.cancellationReason;
    await reservation.save();

    await releaseRoomIfUnused(roomId);

    // Void an invoice that was issued in advance; keep it for the record.
    await Invoice.updateOne(
      { reservation: id, status: { $nin: ["PAID", "CANCELLED"] } },
      { $set: { status: "CANCELLED" } },
    );

    return ok(
      { id, reservationStatus: reservation.reservationStatus, amountPaid: reservation.amountPaid },
      input.markNoShow
        ? `Reservation ${reservation.reservationNumber} marked as a no-show`
        : `Reservation ${reservation.reservationNumber} cancelled`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
