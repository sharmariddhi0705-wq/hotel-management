import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Reservation, Room, RoomType } from "@/models";
import { updateRoomSchema } from "@/schemas/room";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/constants";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("rooms:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const room = await Room.findById(id)
      .populate("roomType")
      .populate("assignedHousekeeper", "firstName lastName employeeId department")
      .lean();
    if (!room) throw new NotFoundError("Room");

    // The room detail page shows the booking calendar alongside the room.
    const upcoming = await Reservation.find({
      room: id,
      reservationStatus: { $in: BLOCKING_RESERVATION_STATUSES },
      checkOutDate: { $gte: new Date() },
    })
      .populate("guest", "firstName lastName phone")
      .sort({ checkInDate: 1 })
      .limit(20)
      .lean();

    return ok({ room, upcomingReservations: upcoming }, "Room loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("rooms:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateRoomSchema.parse(await request.json());

    await connectToDatabase();
    const room = await Room.findById(id);
    if (!room) throw new NotFoundError("Room");

    if (input.roomType) {
      const roomType = await RoomType.findById(input.roomType).select("_id").lean();
      if (!roomType) {
        throw new ValidationError("Choose an existing room type", {
          roomType: "Select a room type",
        });
      }
    }

    if (input.roomNumber && input.roomNumber !== room.roomNumber) {
      const clash = await Room.findOne({ roomNumber: input.roomNumber, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (clash) throw new ConflictError(`Room ${input.roomNumber} already exists`);
    }

    /**
     * A room with a guest in it cannot be taken out of service, and one that is
     * still occupied cannot be marked available — that would let the front desk
     * sell an occupied room.
     */
    if (input.status && input.status !== room.status) {
      const hasGuestInHouse = await Reservation.exists({
        room: id,
        reservationStatus: "CHECKED_IN",
      });
      if (hasGuestInHouse && ["OUT_OF_SERVICE", "MAINTENANCE", "AVAILABLE"].includes(input.status)) {
        throw new ConflictError(
          `Room ${room.roomNumber} has a guest in house. Check them out first.`,
        );
      }
    }

    Object.assign(room, input);
    await room.save();

    const populated = await Room.findById(room._id).populate("roomType", "name slug basePrice").lean();
    return ok(populated, `Room ${room.roomNumber} updated`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("rooms:delete");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const room = await Room.findById(id).select("roomNumber");
    if (!room) throw new NotFoundError("Room");

    /**
     * Deleting a room with reservations attached would orphan them and corrupt
     * historical invoices, so refuse and let the user deactivate it instead.
     */
    const active = await Reservation.countDocuments({
      room: id,
      reservationStatus: { $in: BLOCKING_RESERVATION_STATUSES },
    });
    if (active > 0) {
      throw new ConflictError(
        `Room ${room.roomNumber} has ${active} active reservation(s). Cancel them or mark the room inactive instead.`,
      );
    }

    const historical = await Reservation.countDocuments({ room: id });
    if (historical > 0) {
      // Preserve history: retire the room rather than removing the record.
      await Room.updateOne(
        { _id: id },
        { $set: { isActive: false, status: "OUT_OF_SERVICE" } },
      );
      return ok(
        { id, archived: true },
        `Room ${room.roomNumber} has past reservations, so it was retired instead of deleted`,
      );
    }

    await room.deleteOne();
    return ok({ id, archived: false }, `Room ${room.roomNumber} deleted`);
  } catch (error) {
    return handleApiError(error);
  }
}
