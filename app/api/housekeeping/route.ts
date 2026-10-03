import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Room, Staff, nextFormattedNumber } from "@/models";
import { housekeepingQuerySchema, housekeepingTaskSchema } from "@/schemas/housekeeping";
import { requirePermission } from "@/lib/session";
import { buildPaginationMeta, created, handleApiError, ok } from "@/lib/api-response";
import { buildSort, searchParamsToObject } from "@/lib/query";
import { NotFoundError, ValidationError } from "@/lib/errors";

const SORTABLE = ["scheduledFor", "priority", "status", "createdAt"] as const;

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("housekeeping:view");
    const query = housekeepingQuerySchema.parse(searchParamsToObject(request));

    await connectToDatabase();

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.type) filter.type = query.type;
    if (query.room) filter.room = query.room;
    if (query.from || query.to) {
      filter.scheduledFor = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    /**
     * Housekeeping staff see only their own assignments. Their own staff record
     * is resolved from the session rather than trusted from the query string.
     */
    if (actor.role === "HOUSEKEEPING") {
      filter.assignedTo = actor.staffId ?? null;
    } else if (query.assignedTo) {
      filter.assignedTo = query.assignedTo;
    }

    const sort = buildSort(query.sort, query.order, SORTABLE, { scheduledFor: 1 });
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      HousekeepingTask.find(filter)
        .populate("room", "roomNumber floor status housekeepingStatus")
        .populate("assignedTo", "firstName lastName employeeId")
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean(),
      HousekeepingTask.countDocuments(filter),
    ]);

    return ok(rows, "Housekeeping tasks loaded", {
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("housekeeping:update");
    const input = housekeepingTaskSchema.parse(await request.json());

    await connectToDatabase();

    const room = await Room.findById(input.room).select("roomNumber").lean();
    if (!room) throw new NotFoundError("Room");

    if (input.assignedTo) {
      const staff = await Staff.findById(input.assignedTo).select("status").lean();
      if (!staff) {
        throw new ValidationError("That staff member does not exist", {
          assignedTo: "Select a staff member",
        });
      }
      if (staff.status !== "ACTIVE") {
        throw new ValidationError("That staff member is not active", {
          assignedTo: "Staff member is unavailable",
        });
      }
    }

    const task = await HousekeepingTask.create({
      ...input,
      taskCode: await nextFormattedNumber("HK"),
      createdBy: actor.id,
    });

    const full = await HousekeepingTask.findById(task._id)
      .populate("room", "roomNumber floor")
      .populate("assignedTo", "firstName lastName")
      .lean();

    return created(full, `Task ${task.taskCode} created for room ${room.roomNumber}`);
  } catch (error) {
    return handleApiError(error);
  }
}
