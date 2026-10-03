import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Reservation, Room } from "@/models";
import { updateHousekeepingTaskSchema } from "@/schemas/housekeeping";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { can } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("housekeeping:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const task = await HousekeepingTask.findById(id)
      .populate("room", "roomNumber floor status housekeepingStatus")
      .populate("assignedTo", "firstName lastName employeeId")
      .lean();
    if (!task) throw new NotFoundError("Task");

    return ok(task, "Task loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Updates a housekeeping task and, as a consequence, the room board.
 *
 * Completing a cleaning task is what returns a vacated room to AVAILABLE — the
 * one place in the system where a room becomes sellable again after a departure.
 * A room with a guest still in it is never made available by this route.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("housekeeping:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateHousekeepingTaskSchema.parse(await request.json());

    // Reassigning work is a supervisor action, distinct from doing the work.
    if (input.assignedTo !== undefined && !can(actor.role, "housekeeping:assign")) {
      throw new ForbiddenError("Only a manager can reassign housekeeping tasks");
    }

    await connectToDatabase();
    const task = await HousekeepingTask.findById(id);
    if (!task) throw new NotFoundError("Task");

    // Housekeepers may only touch their own tasks.
    if (
      actor.role === "HOUSEKEEPING" &&
      String(task.assignedTo ?? "") !== String(actor.staffId ?? "")
    ) {
      throw new ForbiddenError("That task is assigned to someone else");
    }

    const previousStatus = task.status;
    Object.assign(task, input);

    if (input.status === "IN_PROGRESS" && !task.startedAt) {
      task.startedAt = new Date();
    }
    if (input.status === "COMPLETED" && previousStatus !== "COMPLETED") {
      task.completedAt = new Date();
      task.completedBy = new Types.ObjectId(actor.id);
    }
    await task.save();

    const room = await Room.findById(task.room);
    let roomMessage = "";

    if (room) {
      if (input.status === "IN_PROGRESS") {
        room.housekeepingStatus = "IN_PROGRESS";
        await room.save();
      } else if (input.status === "COMPLETED") {
        const isMaintenance = task.type === "MAINTENANCE";
        room.housekeepingStatus = isMaintenance ? "CLEAN" : "INSPECTED";
        room.lastCleanedAt = new Date();

        const guestInHouse = await Reservation.exists({
          room: room._id,
          reservationStatus: "CHECKED_IN",
        });

        if (!guestInHouse && ["CLEANING", "MAINTENANCE"].includes(room.status)) {
          // Anything still booked for later keeps the room on hold.
          const held = await Reservation.exists({
            room: room._id,
            reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
          });
          room.status = held ? "RESERVED" : "AVAILABLE";
          roomMessage = ` Room ${room.roomNumber} is now ${room.status.toLowerCase()}.`;
        }
        await room.save();
      }
    }

    const full = await HousekeepingTask.findById(id)
      .populate("room", "roomNumber floor status housekeepingStatus")
      .populate("assignedTo", "firstName lastName")
      .lean();

    return ok(full, `Task ${task.taskCode} updated.${roomMessage}`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("housekeeping:assign");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const task = await HousekeepingTask.findById(id).select("taskCode");
    if (!task) throw new NotFoundError("Task");

    await task.deleteOne();
    return ok({ id }, `Task ${task.taskCode} removed`);
  } catch (error) {
    return handleApiError(error);
  }
}
