import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Reservation, Room } from "@/models";
import { paginationSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { buildPaginationMeta, handleApiError, ok } from "@/lib/api-response";
import { buildSearchFilter, searchParamsToObject } from "@/lib/query";
import { todayUtc } from "@/lib/dates";
import { z } from "zod";
import { HOUSEKEEPING_STATUSES, ROOM_STATUSES } from "@/lib/constants";

const boardQuerySchema = paginationSchema.extend({
  housekeepingStatus: z.enum(HOUSEKEEPING_STATUSES).optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  floor: z.coerce.number().int().optional(),
  assignedHousekeeper: z.string().optional(),
});

/**
 * The housekeeping room board.
 *
 * Returns each room with its cleaning state, assigned housekeeper, open task and
 * whether a departure is expected today — the information a floor supervisor
 * needs in one view. The three lookups are batched rather than run per room.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("housekeeping:view");
    const query = boardQuerySchema.parse(searchParamsToObject(request));

    await connectToDatabase();

    const filter: Record<string, unknown> = {
      isActive: true,
      ...buildSearchFilter(query.search, ["roomNumber"]),
    };
    if (query.housekeepingStatus) filter.housekeepingStatus = query.housekeepingStatus;
    if (query.status) filter.status = query.status;
    if (query.floor !== undefined) filter.floor = query.floor;

    if (actor.role === "HOUSEKEEPING" && actor.staffId) {
      // A housekeeper's board is their own rooms only.
      filter.assignedHousekeeper = actor.staffId;
    } else if (query.assignedHousekeeper === "unassigned") {
      filter.assignedHousekeeper = null;
    } else if (query.assignedHousekeeper) {
      filter.assignedHousekeeper = query.assignedHousekeeper;
    }

    const skip = (query.page - 1) * query.limit;

    const [rooms, total] = await Promise.all([
      Room.find(filter)
        .populate("roomType", "name")
        .populate("assignedHousekeeper", "firstName lastName employeeId")
        .sort({ floor: 1, roomNumber: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Room.countDocuments(filter),
    ]);

    const roomIds = rooms.map((r) => r._id);
    const today = todayUtc();
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const [openTasks, departures, arrivals] = await Promise.all([
      HousekeepingTask.find({
        room: { $in: roomIds },
        status: { $in: ["PENDING", "IN_PROGRESS"] },
      })
        .select("taskCode room type status priority assignedTo scheduledFor")
        .populate("assignedTo", "firstName lastName")
        .lean(),
      Reservation.find({
        room: { $in: roomIds },
        reservationStatus: "CHECKED_IN",
        checkOutDate: { $gte: today, $lt: tomorrow },
      })
        .select("room reservationNumber checkOutDate")
        .lean(),
      Reservation.find({
        room: { $in: roomIds },
        reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
        checkInDate: { $gte: today, $lt: tomorrow },
      })
        .select("room reservationNumber checkInDate")
        .lean(),
    ]);

    const taskByRoom = new Map(openTasks.map((t) => [String(t.room), t]));
    const departingRooms = new Set(departures.map((d) => String(d.room)));
    const arrivingRooms = new Set(arrivals.map((a) => String(a.room)));

    const board = rooms.map((room) => ({
      ...room,
      openTask: taskByRoom.get(String(room._id)) ?? null,
      departingToday: departingRooms.has(String(room._id)),
      arrivingToday: arrivingRooms.has(String(room._id)),
    }));

    return ok(board, "Housekeeping board loaded", {
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
