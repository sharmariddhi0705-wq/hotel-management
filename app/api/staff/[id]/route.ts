import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Room, Staff, User } from "@/models";
import { updateStaffSchema } from "@/schemas/staff";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("staff:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();

    const [staff, openTasks, assignedRooms] = await Promise.all([
      Staff.findById(id).populate("user", "email role status lastLoginAt").lean(),
      HousekeepingTask.find({ assignedTo: id, status: { $in: ["PENDING", "IN_PROGRESS"] } })
        .populate("room", "roomNumber floor")
        .sort({ scheduledFor: 1 })
        .lean(),
      Room.find({ assignedHousekeeper: id }).select("roomNumber floor housekeepingStatus").lean(),
    ]);

    if (!staff) throw new NotFoundError("Staff member");

    return ok({ staff, openTasks, assignedRooms }, "Staff member loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("staff:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateStaffSchema.parse(await request.json());

    await connectToDatabase();
    const staff = await Staff.findById(id);
    if (!staff) throw new NotFoundError("Staff member");

    if (input.email && input.email !== staff.email) {
      const clash = await Staff.findOne({ email: input.email, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (clash) throw new ConflictError("A staff member with that email already exists");
    }

    Object.assign(staff, input);
    await staff.save();

    /**
     * A staff member who has left must not keep an active login, and their room
     * assignments are cleared so the housekeeping board does not show work
     * against somebody who is no longer on shift.
     */
    if (input.status && input.status !== "ACTIVE" && staff.user) {
      await User.updateOne({ _id: staff.user }, { $set: { status: "INACTIVE" } });
    }
    if (input.status === "TERMINATED") {
      await Room.updateMany({ assignedHousekeeper: id }, { $set: { assignedHousekeeper: null } });
      await HousekeepingTask.updateMany(
        { assignedTo: id, status: { $in: ["PENDING", "IN_PROGRESS"] } },
        { $set: { assignedTo: null } },
      );
    }

    return ok(staff.toObject(), `${staff.firstName} ${staff.lastName} updated`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("staff:delete");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const staff = await Staff.findById(id).select("firstName lastName user");
    if (!staff) throw new NotFoundError("Staff member");

    const openTasks = await HousekeepingTask.countDocuments({
      assignedTo: id,
      status: { $in: ["PENDING", "IN_PROGRESS"] },
    });
    if (openTasks > 0) {
      throw new ConflictError(
        `${staff.firstName} has ${openTasks} open task(s). Reassign them first.`,
      );
    }

    if (staff.user) {
      throw new ConflictError(
        "This staff member has a login account. Remove the user account first.",
      );
    }

    await Room.updateMany({ assignedHousekeeper: id }, { $set: { assignedHousekeeper: null } });
    await staff.deleteOne();

    return ok({ id }, `${staff.firstName} ${staff.lastName} removed`);
  } catch (error) {
    return handleApiError(error);
  }
}
