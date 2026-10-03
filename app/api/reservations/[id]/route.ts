import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Invoice, Payment, Reservation, Room } from "@/models";
import { updateReservationSchema } from "@/schemas/reservation";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { assertRoomIsBookable, normaliseStayRange } from "@/lib/availability";
import { recalculateReservationTotals } from "@/lib/folio";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { holdRoomForReservation, releaseRoomIfUnused } from "@/lib/rooms";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("reservations:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();

    const [reservation, payments, invoice] = await Promise.all([
      Reservation.findById(id)
        .populate("guest")
        .populate("room", "roomNumber floor status housekeepingStatus amenities")
        .populate("roomType", "name basePrice amenities")
        .populate("createdBy", "name")
        .populate("checkedInBy", "name")
        .populate("checkedOutBy", "name")
        .lean(),
      Payment.find({ reservation: id }).sort({ paymentDate: -1 }).lean(),
      Invoice.findOne({ reservation: id }).select("invoiceNumber status totalAmount balanceDue").lean(),
    ]);

    if (!reservation) throw new NotFoundError("Reservation");

    return ok({ reservation, payments, invoice }, "Reservation loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Edits a reservation.
 *
 * Changing dates or the room re-runs the double-booking check against the new
 * range, excluding this reservation so it does not conflict with itself.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("reservations:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateReservationSchema.parse(await request.json());

    await connectToDatabase();
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new NotFoundError("Reservation");

    if (["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservation.reservationStatus)) {
      throw new ConflictError(
        `A ${reservation.reservationStatus.toLowerCase().replace(/_/g, " ")} reservation can no longer be edited`,
      );
    }

    const range = normaliseStayRange({
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    });

    /**
     * A guest already in house cannot have their arrival date moved — the stay
     * has started. Extending the departure date is allowed and is the normal way
     * to handle a stay extension.
     */
    if (reservation.reservationStatus === "CHECKED_IN") {
      if (range.checkInDate.getTime() !== reservation.checkInDate.getTime()) {
        throw new ConflictError(
          "This guest has already checked in, so the arrival date cannot change",
        );
      }
      if (String(input.room) !== String(reservation.room)) {
        throw new ConflictError(
          "Use a room move rather than editing the room of an in-house reservation",
        );
      }
    }

    const roomChanged = String(input.room) !== String(reservation.room);
    const datesChanged =
      range.checkInDate.getTime() !== reservation.checkInDate.getTime() ||
      range.checkOutDate.getTime() !== reservation.checkOutDate.getTime();

    if (roomChanged || datesChanged) {
      await assertRoomIsBookable(input.room, range, {
        excludeReservationId: id,
        adults: input.adults,
        children: input.children,
      });
    }

    const previousRoomId = String(reservation.room);

    reservation.checkInDate = range.checkInDate;
    reservation.checkOutDate = range.checkOutDate;
    reservation.adults = input.adults;
    reservation.children = input.children;
    reservation.pricePerNight = input.pricePerNight;
    reservation.taxPercent = input.taxPercent;
    reservation.discount = input.discount;
    reservation.specialRequests = input.specialRequests;
    reservation.source = input.source ?? reservation.source;
    reservation.preferredPaymentMethod =
      input.preferredPaymentMethod ?? reservation.preferredPaymentMethod;
    reservation.updatedBy = new Types.ObjectId(actor.id);

    if (input.reservationStatus) {
      reservation.reservationStatus = input.reservationStatus;
    }

    if (roomChanged) {
      const newRoom = await Room.findById(input.room).select("roomType status").lean();
      if (!newRoom) throw new NotFoundError("Room");
      reservation.room = newRoom._id;
      reservation.roomType = newRoom.roomType;
    }

    await reservation.save();
    const totals = await recalculateReservationTotals(reservation._id);

    // Release the old room and hold the new one.
    if (roomChanged) {
      await releaseRoomIfUnused(previousRoomId);
      await holdRoomForReservation(String(reservation.room));
    }

    const full = await Reservation.findById(id)
      .populate("guest", "firstName lastName email phone")
      .populate("room", "roomNumber floor")
      .populate("roomType", "name")
      .lean();

    return ok({ reservation: full, totals }, `Reservation ${reservation.reservationNumber} updated`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("reservations:delete");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const reservation = await Reservation.findById(id).select(
      "reservationNumber reservationStatus room amountPaid",
    );
    if (!reservation) throw new NotFoundError("Reservation");

    if (reservation.reservationStatus === "CHECKED_IN") {
      throw new ConflictError("Check the guest out before deleting this reservation");
    }
    if (reservation.amountPaid > 0) {
      throw new ConflictError(
        "Payments have been taken against this reservation, so it cannot be deleted. Cancel and refund it instead.",
      );
    }

    const roomId = String(reservation.room);
    await Payment.deleteMany({ reservation: id });
    await reservation.deleteOne();
    await releaseRoomIfUnused(roomId);

    return ok({ id }, `Reservation ${reservation.reservationNumber} deleted`);
  } catch (error) {
    return handleApiError(error);
  }
}
