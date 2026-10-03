import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Reservation, Room, Staff, nextFormattedNumber } from "@/models";
import { roomHousekeepingSchema } from "@/schemas/housekeeping";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Updates a room's housekeeping state directly from the board.
 *
 * Marking a room CLEAN is the shortcut for "this room is ready": if nobody is in
 * house it becomes AVAILABLE again (or RESERVED when a later booking holds it).
 * Flagging maintenance takes the room out of service and raises a task, so the
 * room cannot be sold until an engineer closes it.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("housekeeping:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = roomHousekeepingSchema.parse(await request.json());

    if (input.assignedHousekeeper !== undefined && !can(actor.role, "housekeeping:assign")) {
      throw new ForbiddenError("Only a manager can assign housekeeping staff");
    }

    await connectToDatabase();
    const room = await Room.findById(id);
    if (!room) throw new NotFoundError("Room");

    if (
      actor.role === "HOUSEKEEPING" &&
      String(room.assignedHousekeeper ?? "") !== String(actor.staffId ?? "")
    ) {
      throw new ForbiddenError("That room is assigned to another housekeeper");
    }

    if (input.assignedHousekeeper) {
      const staff = await Staff.findById(input.assignedHousekeeper)
        .select("status department firstName lastName")
        .lean();
      if (!staff) {
        throw new ValidationError("That staff member does not exist", {
          assignedHousekeeper: "Select a staff member",
        });
      }
      if (staff.status !== "ACTIVE") {
        throw new ValidationError(
          `${staff.firstName} ${staff.lastName} is not currently active`,
          { assignedHousekeeper: "Staff member is unavailable" },
        );
      }
      room.assignedHousekeeper = staff._id;
    } else if (input.assignedHousekeeper === null) {
      room.assignedHousekeeper = null;
    }

    if (input.housekeepingNotes !== undefined) {
      room.housekeepingNotes = input.housekeepingNotes;
    }

    let message = `Room ${room.roomNumber} updated`;

    if (input.markMaintenance) {
      const guestInHouse = await Reservation.exists({
        room: room._id,
        reservationStatus: "CHECKED_IN",
      });
      if (guestInHouse) {
        throw new ConflictError(
          `Room ${room.roomNumber} has a guest in house. Move them before taking it out of service.`,
        );
      }

      room.housekeepingStatus = "MAINTENANCE_REQUIRED";
      room.status = "MAINTENANCE";

      await HousekeepingTask.create({
        taskCode: await nextFormattedNumber("HK"),
        room: room._id,
        type: "MAINTENANCE",
        status: "PENDING",
        priority: "URGENT",
        scheduledFor: new Date(),
        notes: input.housekeepingNotes ?? "Maintenance flagged from the housekeeping board",
        createdBy: actor.id,
      });

      message = `Room ${room.roomNumber} flagged for maintenance`;
    } else if (input.housekeepingStatus) {
      room.housekeepingStatus = input.housekeepingStatus;

      if (input.housekeepingStatus === "IN_PROGRESS" && room.status === "AVAILABLE") {
        room.status = "CLEANING";
      }

      if (["CLEAN", "INSPECTED"].includes(input.housekeepingStatus)) {
        room.lastCleanedAt = new Date();

        const guestInHouse = await Reservation.exists({
          room: room._id,
          reservationStatus: "CHECKED_IN",
        });

        if (!guestInHouse && ["CLEANING", "MAINTENANCE"].includes(room.status)) {
          const held = await Reservation.exists({
            room: room._id,
            reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
          });
          room.status = held ? "RESERVED" : "AVAILABLE";
          message = `Room ${room.roomNumber} is ready and now ${room.status.toLowerCase()}`;
        } else {
          message = `Room ${room.roomNumber} marked clean`;
        }

        // Close any open cleaning task so the board does not show stale work.
        await HousekeepingTask.updateMany(
          { room: room._id, status: { $in: ["PENDING", "IN_PROGRESS"] }, type: { $ne: "MAINTENANCE" } },
          { $set: { status: "COMPLETED", completedAt: new Date(), completedBy: actor.id } },
        );
      }

      if (input.housekeepingStatus === "MAINTENANCE_REQUIRED" && room.status !== "OCCUPIED") {
        room.status = "MAINTENANCE";
      }
    }

    await room.save();

    const full = await Room.findById(id)
      .populate("roomType", "name")
      .populate("assignedHousekeeper", "firstName lastName employeeId")
      .lean();

    return ok(full, message);
  } catch (error) {
    return handleApiError(error);
  }
}
