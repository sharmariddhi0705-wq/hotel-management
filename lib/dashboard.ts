import {
  Guest,
  HousekeepingTask,
  Payment,
  Reservation,
  Room,
} from "@/models";
import { addDays, isoDay, startOfUtcMonth, todayUtc } from "@/lib/dates";
import { round2 } from "@/lib/pricing";
import { serialise } from "@/lib/query";
import { ROOM_STATUSES } from "@/lib/constants";

/**
 * Dashboard aggregation.
 *
 * Every figure comes from one `Promise.all` batch so the page costs a fixed
 * number of round trips regardless of how much data exists. All date windows use
 * UTC day boundaries, matching how stay dates are stored.
 */

export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  reservedRooms: number;
  cleaningRooms: number;
  outOfServiceRooms: number;
  occupancyRate: number;
  todaysCheckIns: number;
  todaysCheckOuts: number;
  pendingArrivals: number;
  pendingDepartures: number;
  inHouseGuests: number;
  todaysRevenue: number;
  monthlyRevenue: number;
  outstandingBalance: number;
  openHousekeepingTasks: number;
  totalGuests: number;
}

export interface TrendPoint {
  date: string;
  label: string;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrend: (TrendPoint & { revenue: number; reservations: number })[];
  occupancyTrend: (TrendPoint & { occupancy: number })[];
  roomStatusBreakdown: { status: string; count: number }[];
  reservationStatusBreakdown: { status: string; count: number }[];
  recentReservations: RecentReservation[];
  recentCheckIns: RecentMovement[];
  recentCheckOuts: RecentMovement[];
  recentPayments: RecentPayment[];
  generatedAt: string;
}

export interface RecentReservation {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  reservationStatus: string;
  paymentStatus: string;
  createdAt: string;
  guest?: { firstName: string; lastName: string } | null;
  room?: { roomNumber: string } | null;
}

export interface RecentMovement {
  _id: string;
  reservationNumber: string;
  actualCheckInTime?: string | null;
  actualCheckOutTime?: string | null;
  totalAmount?: number;
  guest?: { firstName: string; lastName: string } | null;
  room?: { roomNumber: string } | null;
}

export interface RecentPayment {
  _id: string;
  paymentId: string;
  amount: number;
  method: string;
  kind: string;
  paymentDate: string;
  guest?: { firstName: string; lastName: string } | null;
  reservation?: { reservationNumber: string } | null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const today = todayUtc();
  const tomorrow = addDays(today, 1);
  const monthStart = startOfUtcMonth(today);
  const trendStart = addDays(today, -13);

  const [
    roomCounts,
    reservationCounts,
    arrivalsToday,
    departuresToday,
    checkedInToday,
    checkedOutToday,
    inHouse,
    revenueToday,
    revenueMonth,
    outstanding,
    openTasks,
    totalGuests,
    revenueSeries,
    reservationSeries,
    occupancySeries,
    recentReservations,
    recentCheckIns,
    recentCheckOuts,
    recentPayments,
  ] = await Promise.all([
    Room.aggregate<{ _id: string; count: number }>([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Reservation.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$reservationStatus", count: { $sum: 1 } } },
    ]),
    Reservation.countDocuments({
      checkInDate: { $gte: today, $lt: tomorrow },
      reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
    }),
    Reservation.countDocuments({
      checkOutDate: { $gte: today, $lt: tomorrow },
      reservationStatus: "CHECKED_IN",
    }),
    Reservation.countDocuments({ actualCheckInTime: { $gte: today, $lt: tomorrow } }),
    Reservation.countDocuments({ actualCheckOutTime: { $gte: today, $lt: tomorrow } }),
    Reservation.countDocuments({ reservationStatus: "CHECKED_IN" }),
    sumRevenue(today, tomorrow),
    sumRevenue(monthStart, tomorrow),
    Reservation.aggregate<{ total: number }>([
      {
        $match: {
          reservationStatus: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          balanceDue: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: "$balanceDue" } } },
    ]),
    HousekeepingTask.countDocuments({ status: { $in: ["PENDING", "IN_PROGRESS"] } }),
    Guest.countDocuments({}),
    dailyRevenueSeries(trendStart, tomorrow),
    dailyReservationSeries(trendStart, tomorrow),
    dailyOccupancySeries(trendStart, today),
    Reservation.find({})
      .populate("guest", "firstName lastName")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(6)
      .select(
        "reservationNumber checkInDate checkOutDate totalAmount reservationStatus paymentStatus createdAt",
      )
      .lean(),
    Reservation.find({ actualCheckInTime: { $ne: null } })
      .populate("guest", "firstName lastName")
      .populate("room", "roomNumber")
      .sort({ actualCheckInTime: -1 })
      .limit(6)
      .select("reservationNumber actualCheckInTime")
      .lean(),
    Reservation.find({ actualCheckOutTime: { $ne: null } })
      .populate("guest", "firstName lastName")
      .populate("room", "roomNumber")
      .sort({ actualCheckOutTime: -1 })
      .limit(6)
      .select("reservationNumber actualCheckOutTime totalAmount")
      .lean(),
    Payment.find({ status: "COMPLETED" })
      .populate("guest", "firstName lastName")
      .populate("reservation", "reservationNumber")
      .sort({ paymentDate: -1 })
      .limit(6)
      .select("paymentId amount method kind paymentDate")
      .lean(),
  ]);

  const roomMap = new Map(roomCounts.map((r) => [r._id, r.count]));
  const totalRooms = roomCounts.reduce((sum, r) => sum + r.count, 0);
  const occupiedRooms = roomMap.get("OCCUPIED") ?? 0;

  const stats: DashboardStats = {
    totalRooms,
    availableRooms: roomMap.get("AVAILABLE") ?? 0,
    occupiedRooms,
    reservedRooms: roomMap.get("RESERVED") ?? 0,
    cleaningRooms: roomMap.get("CLEANING") ?? 0,
    outOfServiceRooms:
      (roomMap.get("MAINTENANCE") ?? 0) + (roomMap.get("OUT_OF_SERVICE") ?? 0),
    occupancyRate: totalRooms > 0 ? round2((occupiedRooms / totalRooms) * 100) : 0,
    todaysCheckIns: checkedInToday,
    todaysCheckOuts: checkedOutToday,
    pendingArrivals: arrivalsToday,
    pendingDepartures: departuresToday,
    inHouseGuests: inHouse,
    todaysRevenue: revenueToday,
    monthlyRevenue: revenueMonth,
    outstandingBalance: round2(outstanding[0]?.total ?? 0),
    openHousekeepingTasks: openTasks,
    totalGuests,
  };

  // Merge the two daily series so one chart can show revenue and booking volume.
  const reservationByDay = new Map(reservationSeries.map((r) => [r.date, r.reservations]));
  const revenueTrend = revenueSeries.map((row) => ({
    ...row,
    reservations: reservationByDay.get(row.date) ?? 0,
  }));

  return serialise({
    stats,
    revenueTrend,
    occupancyTrend: occupancySeries,
    roomStatusBreakdown: ROOM_STATUSES.map((status) => ({
      status,
      count: roomMap.get(status) ?? 0,
    })).filter((row) => row.count > 0),
    reservationStatusBreakdown: reservationCounts.map((r) => ({
      status: r._id,
      count: r.count,
    })),
    recentReservations,
    recentCheckIns,
    recentCheckOuts,
    recentPayments,
    generatedAt: new Date().toISOString(),
  }) as unknown as DashboardData;
}

/** Net cash taken in a window: completed payments minus refunds. */
async function sumRevenue(from: Date, to: Date): Promise<number> {
  const rows = await Payment.aggregate<{ _id: string; total: number }>([
    { $match: { status: "COMPLETED", paymentDate: { $gte: from, $lt: to } } },
    { $group: { _id: "$kind", total: { $sum: "$amount" } } },
  ]);
  const paid = rows.find((r) => r._id === "PAYMENT")?.total ?? 0;
  const refunded = rows.find((r) => r._id === "REFUND")?.total ?? 0;
  return round2(paid - refunded);
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

async function dailyRevenueSeries(from: Date, to: Date) {
  const rows = await Payment.aggregate<{ _id: string; payment: number; refund: number }>([
    { $match: { status: "COMPLETED", paymentDate: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate", timezone: "UTC" } },
        payment: { $sum: { $cond: [{ $eq: ["$kind", "PAYMENT"] }, "$amount", 0] } },
        refund: { $sum: { $cond: [{ $eq: ["$kind", "REFUND"] }, "$amount", 0] } },
      },
    },
  ]);

  const map = new Map(rows.map((r) => [r._id, round2(r.payment - r.refund)]));
  return fillDays(from, to, (day) => ({ revenue: map.get(day) ?? 0 }));
}

async function dailyReservationSeries(from: Date, to: Date) {
  const rows = await Reservation.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
        count: { $sum: 1 },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return fillDays(from, to, (day) => ({ reservations: map.get(day) ?? 0 }));
}

/**
 * Occupancy per night over the window.
 *
 * A stay occupies every night it spans, so this counts reservations whose range
 * covers each day rather than grouping by a single date field.
 */
async function dailyOccupancySeries(from: Date, to: Date) {
  const totalRooms = await Room.countDocuments({ isActive: true });

  const reservations = await Reservation.find({
    reservationStatus: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    checkInDate: { $lt: addDays(to, 1) },
    checkOutDate: { $gt: from },
  })
    .select("checkInDate checkOutDate")
    .lean();

  return fillDays(from, addDays(to, 1), (day) => {
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const occupied = reservations.filter(
      (r) => r.checkInDate <= dayStart && r.checkOutDate > dayStart,
    ).length;
    return { occupancy: totalRooms > 0 ? round2((occupied / totalRooms) * 100) : 0 };
  });
}

/** Produces one entry per UTC day in [from, to), so charts have no gaps. */
function fillDays<T extends object>(
  from: Date,
  to: Date,
  build: (day: string) => T,
): (T & TrendPoint)[] {
  const out: (T & TrendPoint)[] = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const day = isoDay(cursor);
    out.push({ date: day, label: DAY_LABEL.format(cursor), ...build(day) });
    cursor = addDays(cursor, 1);
  }
  return out;
}
