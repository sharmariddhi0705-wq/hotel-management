import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Guest, Reservation, Room } from "@/models";
import { checkInSchema } from "@/schemas/reservation";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { assertRoomIsBookable } from "@/lib/availability";
import { releaseRoomIfUnused } from "@/lib/rooms";
import { startOfUtcDay, todayUtc } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Checks a guest in.
 *
 * Preconditions, in the order the front desk would check them:
 *  - the reservation exists and is PENDING or CONFIRMED,
 *  - today is on or after the arrival date (and the stay has not already ended),
 *  - the guest profile still exists and is not blacklisted,
 *  - the room is physically ready — not dirty, under maintenance, or occupied.
 *
 * On success the reservation becomes CHECKED_IN, the room becomes OCCUPIED, and
 * the arrival is stamped with the time and the member of staff who did it.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("checkin:manage");
    const input = checkInSchema.parse(await request.json());

    await connectToDatabase();

    const reservation = await Reservation.findById(input.reservation);
    if (!reservation) throw new NotFoundError("Reservation");

    if (reservation.reservationStatus === "CHECKED_IN") {
      throw new ConflictError(
        `Reservation ${reservation.reservationNumber} is already checked in`,
      );
    }
    if (!["PENDING", "CONFIRMED"].includes(reservation.reservationStatus)) {
      throw new ConflictError(
        `Reservation ${reservation.reservationNumber} is ${reservation.reservationStatus
          .toLowerCase()
          .replace(/_/g, " ")} and cannot be checked in`,
      );
    }

    const today = todayUtc();
    if (startOfUtcDay(reservation.checkInDate) > today) {
      throw new ConflictError(
        `This reservation starts on ${startOfUtcDay(reservation.checkInDate)
          .toISOString()
          .slice(0, 10)}. Early check-in needs the dates to be changed first.`,
      );
    }
    if (startOfUtcDay(reservation.checkOutDate) <= today) {
      throw new ConflictError(
        "This reservation has already ended. Update the dates before checking the guest in.",
      );
    }

    const guest = await Guest.findById(reservation.guest).select(
      "firstName lastName blacklisted idType idNumber",
    );
    if (!guest) throw new NotFoundError("Guest profile");
    if (guest.blacklisted) {
      throw new ConflictError("This guest is blacklisted. Check with a manager.");
    }

    // The desk may reassign the room at arrival (upgrade, maintenance issue).
    const targetRoomId = input.room ?? String(reservation.room);
    const roomChanged = targetRoomId !== String(reservation.room);
    const previousRoomId = String(reservation.room);

    if (roomChanged) {
      await assertRoomIsBookable(targetRoomId, {
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
      }, {
        excludeReservationId: String(reservation._id),
        adults: reservation.adults,
        children: reservation.children,
      });
    }

    const room = await Room.findById(targetRoomId);
    if (!room) throw new NotFoundError("Room");

    if (room.status === "OCCUPIED") {
      throw new ConflictError(
        `Room ${room.roomNumber} is still occupied. Check the previous guest out first.`,
      );
    }
    if (["MAINTENANCE", "OUT_OF_SERVICE"].includes(room.status)) {
      throw new ConflictError(
        `Room ${room.roomNumber} is not serviceable. Move the guest to another room.`,
      );
    }
    if (room.housekeepingStatus === "DIRTY" || room.housekeepingStatus === "IN_PROGRESS") {
      throw new ValidationError(
        `Room ${room.roomNumber} has not been cleaned yet. Mark it clean in Housekeeping, or assign another room.`,
        { room: "Room is not ready" },
      );
    }

    if (roomChanged) {
      reservation.room = room._id;
      reservation.roomType = room.roomType;
    }

    reservation.reservationStatus = "CHECKED_IN";
    reservation.actualCheckInTime = new Date();
    reservation.checkedInBy = new Types.ObjectId(actor.id);
    reservation.idVerified = true;
    reservation.idTypeRecorded = input.idType;
    reservation.idNumberRecorded = input.idNumber;
    if (input.notes) {
      reservation.specialRequests = [reservation.specialRequests, input.notes]
        .filter(Boolean)
        .join("\n");
    }
    await reservation.save();

    room.status = "OCCUPIED";
    await room.save();

    // Backfill the guest's ID details if the profile did not have them.
    if (!guest.idNumber) {
      guest.idType = input.idType as typeof guest.idType;
      guest.idNumber = input.idNumber;
      await guest.save();
    }

    if (roomChanged) await releaseRoomIfUnused(previousRoomId);

    return ok(
      {
        reservationId: String(reservation._id),
        reservationNumber: reservation.reservationNumber,
        reservationStatus: reservation.reservationStatus,
        roomNumber: room.roomNumber,
        roomStatus: room.status,
        actualCheckInTime: reservation.actualCheckInTime,
      },
      `${guest.firstName} ${guest.lastName} checked in to room ${room.roomNumber}`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
