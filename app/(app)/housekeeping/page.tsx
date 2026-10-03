import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import {
  HousekeepingBoard,
  type BoardRoom,
  type HousekeeperOption,
} from "@/components/housekeeping/housekeeping-board";
import { StatCard } from "@/components/dashboard/stat-card";
import { BrushCleaning, CircleCheck, Wrench } from "lucide-react";
import { paginationSchema } from "@/schemas/common";
import { HOUSEKEEPING_STATUSES, ROOM_STATUSES } from "@/lib/constants";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import { HousekeepingTask, Reservation, Room } from "@/models";
import { buildPaginationMeta } from "@/lib/api-response";
import { buildSearchFilter, serialise } from "@/lib/query";
import { fetchHousekeepers, fetchRoomFloors } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { addDays, todayUtc } from "@/lib/dates";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Housekeeping" };
export const dynamic = "force-dynamic";

const boardQuerySchema = paginationSchema.extend({
  housekeepingStatus: z.enum(HOUSEKEEPING_STATUSES).optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  floor: z.coerce.number().int().optional(),
  assignedHousekeeper: z.string().optional(),
});

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("housekeeping:view");
  const query = parsePageParams(boardQuerySchema, await searchParams);

  await connectToDatabase();

  const filter: Record<string, unknown> = {
    isActive: true,
    ...buildSearchFilter(query.search, ["roomNumber"]),
  };
  if (query.housekeepingStatus) filter.housekeepingStatus = query.housekeepingStatus;
  if (query.status) filter.status = query.status;
  if (query.floor !== undefined) filter.floor = query.floor;

  /**
   * A housekeeper sees only their own rooms. The staff id comes from the signed
   * session, never from the query string.
   */
  if (user.role === "HOUSEKEEPING" && user.staffId) {
    filter.assignedHousekeeper = user.staffId;
  } else if (query.assignedHousekeeper === "unassigned") {
    filter.assignedHousekeeper = null;
  } else if (query.assignedHousekeeper) {
    filter.assignedHousekeeper = query.assignedHousekeeper;
  }

  const skip = (query.page - 1) * query.limit;

  const [rooms, total, housekeepers, floors, settings, dirtyCount, taskCount, maintenanceCount] =
    await Promise.all([
      Room.find(filter)
        .populate("roomType", "name")
        .populate("assignedHousekeeper", "firstName lastName employeeId")
        .sort({ floor: 1, roomNumber: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Room.countDocuments(filter),
      fetchHousekeepers(),
      fetchRoomFloors(),
      getHotelSettings(),
      Room.countDocuments({ isActive: true, housekeepingStatus: { $in: ["DIRTY", "IN_PROGRESS"] } }),
      HousekeepingTask.countDocuments({ status: { $in: ["PENDING", "IN_PROGRESS"] } }),
      Room.countDocuments({ status: { $in: ["MAINTENANCE", "OUT_OF_SERVICE"] } }),
    ]);

  // Batch the per-room context rather than querying inside the render loop.
  const roomIds = rooms.map((room) => room._id);
  const today = todayUtc();
  const tomorrow = addDays(today, 1);

  const [openTasks, departures, arrivals] = await Promise.all([
    HousekeepingTask.find({
      room: { $in: roomIds },
      status: { $in: ["PENDING", "IN_PROGRESS"] },
    })
      .select("taskCode room type status priority")
      .lean(),
    Reservation.find({
      room: { $in: roomIds },
      reservationStatus: "CHECKED_IN",
      checkOutDate: { $gte: today, $lt: tomorrow },
    })
      .select("room")
      .lean(),
    Reservation.find({
      room: { $in: roomIds },
      reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
      checkInDate: { $gte: today, $lt: tomorrow },
    })
      .select("room")
      .lean(),
  ]);

  const taskByRoom = new Map(openTasks.map((task) => [String(task.room), task]));
  const departingRooms = new Set(departures.map((row) => String(row.room)));
  const arrivingRooms = new Set(arrivals.map((row) => String(row.room)));

  const board = rooms.map((room) => ({
    ...room,
    openTask: taskByRoom.get(String(room._id)) ?? null,
    departingToday: departingRooms.has(String(room._id)),
    arrivingToday: arrivingRooms.has(String(room._id)),
  }));

  return (
    <>
      <PageHeader
        title="Housekeeping"
        description={
          user.role === "HOUSEKEEPING"
            ? "The rooms assigned to you."
            : "Cleaning status across the property. Marking a room clean returns it to the sellable pool."
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Rooms needing attention"
          value={dirtyCount}
          icon={BrushCleaning}
          tone={dirtyCount > 0 ? "warning" : "positive"}
          hint="Dirty or being cleaned"
        />
        <StatCard
          label="Open tasks"
          value={taskCount}
          icon={CircleCheck}
          tone={taskCount > 0 ? "warning" : "positive"}
          hint="Pending or in progress"
        />
        <StatCard
          label="Out of service"
          value={maintenanceCount}
          icon={Wrench}
          tone={maintenanceCount > 0 ? "critical" : "positive"}
          hint="Maintenance or withdrawn"
        />
      </section>

      <HousekeepingBoard
        rooms={serialise(board) as unknown as BoardRoom[]}
        meta={buildPaginationMeta(total, query.page, query.limit)}
        housekeepers={housekeepers as unknown as HousekeeperOption[]}
        floors={floors}
        locale={settings.locale}
        permissions={{
          update: can(user.role, "housekeeping:update"),
          assign: can(user.role, "housekeeping:assign"),
        }}
      />
    </>
  );
}
