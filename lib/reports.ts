import { Guest, Payment, Reservation, Room } from "@/models";
import {
  addDays,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
  todayUtc,
} from "@/lib/dates";
import { round2 } from "@/lib/pricing";
import { serialise } from "@/lib/query";
import type { ReportQuery } from "@/schemas/report";

/**
 * Reporting.
 *
 * Every report takes a resolved [from, to) window in UTC. `resolveRange` turns
 * the preset the UI sends into that window, so "this month" means the same thing
 * in the report, the CSV export and the chart.
 */

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export function resolveRange(query: Pick<ReportQuery, "preset" | "from" | "to">): DateRange {
  const today = todayUtc();
  const tomorrow = addDays(today, 1);

  switch (query.preset) {
    case "today":
      return { from: today, to: tomorrow, label: "Today" };
    case "yesterday":
      return { from: addDays(today, -1), to: today, label: "Yesterday" };
    case "week":
      return { from: startOfUtcWeek(today), to: tomorrow, label: "This week" };
    case "year":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        to: tomorrow,
        label: "This year",
      };
    case "custom":
      return {
        from: startOfUtcDay(query.from!),
        // `to` is inclusive in the UI, exclusive in the query.
        to: addDays(startOfUtcDay(query.to!), 1),
        label: `${startOfUtcDay(query.from!).toISOString().slice(0, 10)} to ${startOfUtcDay(
          query.to!,
        )
          .toISOString()
          .slice(0, 10)}`,
      };
    case "month":
    default:
      return { from: startOfUtcMonth(today), to: tomorrow, label: "This month" };
  }
}

export interface RevenueReport {
  range: DateRange;
  totalCollected: number;
  totalRefunded: number;
  netRevenue: number;
  roomRevenue: number;
  extrasRevenue: number;
  taxCollected: number;
  discountsGiven: number;
  outstanding: number;
  averageDailyRate: number;
  revenuePerAvailableRoom: number;
  byMethod: { method: string; amount: number; count: number }[];
  byDay: { date: string; revenue: number }[];
  transactions: number;
}

export async function getRevenueReport(range: DateRange): Promise<RevenueReport> {
  const nights = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));

  const [byKind, byMethod, byDay, stayTotals, outstanding, totalRooms] = await Promise.all([
    Payment.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { status: "COMPLETED", paymentDate: { $gte: range.from, $lt: range.to } } },
      { $group: { _id: "$kind", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate<{ _id: string; total: number; count: number }>([
      {
        $match: {
          status: "COMPLETED",
          kind: "PAYMENT",
          paymentDate: { $gte: range.from, $lt: range.to },
        },
      },
      { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Payment.aggregate<{ _id: string; payment: number; refund: number }>([
      { $match: { status: "COMPLETED", paymentDate: { $gte: range.from, $lt: range.to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate", timezone: "UTC" } },
          payment: { $sum: { $cond: [{ $eq: ["$kind", "PAYMENT"] }, "$amount", 0] } },
          refund: { $sum: { $cond: [{ $eq: ["$kind", "REFUND"] }, "$amount", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    /**
     * Room, extras, tax and discount figures come from the stays themselves —
     * payments alone cannot tell the difference between a room night and a
     * minibar charge.
     */
    Reservation.aggregate<{
      roomRevenue: number;
      extras: number;
      tax: number;
      discount: number;
      nightsSold: number;
    }>([
      {
        $match: {
          reservationStatus: { $in: ["CHECKED_IN", "CHECKED_OUT"] },
          checkInDate: { $lt: range.to },
          checkOutDate: { $gt: range.from },
        },
      },
      {
        $group: {
          _id: null,
          roomRevenue: { $sum: "$roomCharges" },
          extras: {
            $sum: {
              $reduce: {
                input: "$additionalCharges",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    { $multiply: ["$$this.amount", { $ifNull: ["$$this.quantity", 1] }] },
                  ],
                },
              },
            },
          },
          tax: { $sum: "$tax" },
          discount: { $sum: "$discount" },
          nightsSold: { $sum: "$numberOfNights" },
        },
      },
    ]),
    Reservation.aggregate<{ total: number }>([
      {
        $match: {
          balanceDue: { $gt: 0 },
          reservationStatus: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$balanceDue" } } },
    ]),
    Room.countDocuments({ isActive: true }),
  ]);

  const collected = byKind.find((k) => k._id === "PAYMENT")?.total ?? 0;
  const refunded = byKind.find((k) => k._id === "REFUND")?.total ?? 0;
  const transactions = byKind.reduce((sum, k) => sum + k.count, 0);
  const stay = stayTotals[0];
  const nightsSold = stay?.nightsSold ?? 0;

  return serialise({
    range,
    totalCollected: round2(collected),
    totalRefunded: round2(refunded),
    netRevenue: round2(collected - refunded),
    roomRevenue: round2(stay?.roomRevenue ?? 0),
    extrasRevenue: round2(stay?.extras ?? 0),
    taxCollected: round2(stay?.tax ?? 0),
    discountsGiven: round2(stay?.discount ?? 0),
    outstanding: round2(outstanding[0]?.total ?? 0),
    // ADR: average revenue per night actually sold.
    averageDailyRate: nightsSold > 0 ? round2((stay?.roomRevenue ?? 0) / nightsSold) : 0,
    // RevPAR: room revenue spread across every room the hotel could have sold.
    revenuePerAvailableRoom:
      totalRooms > 0 ? round2((stay?.roomRevenue ?? 0) / (totalRooms * nights)) : 0,
    byMethod: byMethod.map((m) => ({
      method: m._id,
      amount: round2(m.total),
      count: m.count,
    })),
    byDay: byDay.map((d) => ({ date: d._id, revenue: round2(d.payment - d.refund) })),
    transactions,
  }) as RevenueReport;
}

export interface OccupancyReport {
  range: DateRange;
  totalRooms: number;
  occupied: number;
  available: number;
  reserved: number;
  cleaning: number;
  outOfService: number;
  occupancyRate: number;
  roomNightsAvailable: number;
  roomNightsSold: number;
  periodOccupancyRate: number;
  byRoomType: {
    roomType: string;
    rooms: number;
    nightsSold: number;
    revenue: number;
    occupancyRate: number;
  }[];
}

export async function getOccupancyReport(range: DateRange): Promise<OccupancyReport> {
  const nights = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000),
  );

  const [statusCounts, nightsSold, byType] = await Promise.all([
    Room.aggregate<{ _id: string; count: number }>([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    /**
     * Room nights sold inside the window, clipped to its edges: a stay that
     * straddles the boundary only contributes the nights that fall inside.
     */
    Reservation.aggregate<{ total: number }>([
      {
        $match: {
          reservationStatus: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          checkInDate: { $lt: range.to },
          checkOutDate: { $gt: range.from },
        },
      },
      {
        $project: {
          nights: {
            $dateDiff: {
              startDate: { $max: ["$checkInDate", range.from] },
              endDate: { $min: ["$checkOutDate", range.to] },
              unit: "day",
            },
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$nights" } } },
    ]),
    Reservation.aggregate<{
      _id: unknown;
      name: string;
      nightsSold: number;
      revenue: number;
    }>([
      {
        $match: {
          reservationStatus: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          checkInDate: { $lt: range.to },
          checkOutDate: { $gt: range.from },
        },
      },
      {
        $group: {
          _id: "$roomType",
          nightsSold: { $sum: "$numberOfNights" },
          revenue: { $sum: "$roomCharges" },
        },
      },
      {
        $lookup: {
          from: "roomtypes",
          localField: "_id",
          foreignField: "_id",
          as: "type",
        },
      },
      { $unwind: { path: "$type", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$type.name", "Unknown"] },
          nightsSold: 1,
          revenue: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const map = new Map(statusCounts.map((s) => [s._id, s.count]));
  const totalRooms = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const occupied = map.get("OCCUPIED") ?? 0;
  const sold = nightsSold[0]?.total ?? 0;

  const roomsPerType = await Room.aggregate<{ _id: unknown; count: number }>([
    { $match: { isActive: true } },
    { $group: { _id: "$roomType", count: { $sum: 1 } } },
  ]);
  const roomCountByType = new Map(roomsPerType.map((r) => [String(r._id), r.count]));

  return serialise({
    range,
    totalRooms,
    occupied,
    available: map.get("AVAILABLE") ?? 0,
    reserved: map.get("RESERVED") ?? 0,
    cleaning: map.get("CLEANING") ?? 0,
    outOfService: (map.get("MAINTENANCE") ?? 0) + (map.get("OUT_OF_SERVICE") ?? 0),
    occupancyRate: totalRooms > 0 ? round2((occupied / totalRooms) * 100) : 0,
    roomNightsAvailable: totalRooms * nights,
    roomNightsSold: sold,
    periodOccupancyRate:
      totalRooms > 0 ? round2((sold / (totalRooms * nights)) * 100) : 0,
    byRoomType: byType.map((t) => {
      const rooms = roomCountByType.get(String(t._id)) ?? 0;
      return {
        roomType: t.name,
        rooms,
        nightsSold: t.nightsSold,
        revenue: round2(t.revenue),
        occupancyRate: rooms > 0 ? round2((t.nightsSold / (rooms * nights)) * 100) : 0,
      };
    }),
  }) as OccupancyReport;
}

export interface ReservationReport {
  range: DateRange;
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  checkedIn: number;
  checkedOut: number;
  noShow: number;
  cancellationRate: number;
  averageStayLength: number;
  averageBookingValue: number;
  totalValue: number;
  bySource: { source: string; count: number; value: number }[];
  byStatus: { status: string; count: number }[];
}

export async function getReservationReport(range: DateRange): Promise<ReservationReport> {
  const match = { createdAt: { $gte: range.from, $lt: range.to } };

  const [byStatus, totals, bySource] = await Promise.all([
    Reservation.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$reservationStatus", count: { $sum: 1 } } },
    ]),
    Reservation.aggregate<{
      total: number;
      value: number;
      nights: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          value: { $sum: "$totalAmount" },
          nights: { $sum: "$numberOfNights" },
        },
      },
    ]),
    Reservation.aggregate<{ _id: string; count: number; value: number }>([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$source", "Unknown"] },
          count: { $sum: 1 },
          value: { $sum: "$totalAmount" },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const map = new Map(byStatus.map((s) => [s._id, s.count]));
  const total = totals[0]?.total ?? 0;
  const cancelled = map.get("CANCELLED") ?? 0;
  const noShow = map.get("NO_SHOW") ?? 0;

  return serialise({
    range,
    total,
    confirmed: map.get("CONFIRMED") ?? 0,
    pending: map.get("PENDING") ?? 0,
    cancelled,
    checkedIn: map.get("CHECKED_IN") ?? 0,
    checkedOut: map.get("CHECKED_OUT") ?? 0,
    noShow,
    cancellationRate: total > 0 ? round2(((cancelled + noShow) / total) * 100) : 0,
    averageStayLength: total > 0 ? round2((totals[0]?.nights ?? 0) / total) : 0,
    averageBookingValue: total > 0 ? round2((totals[0]?.value ?? 0) / total) : 0,
    totalValue: round2(totals[0]?.value ?? 0),
    bySource: bySource.map((s) => ({
      source: s._id,
      count: s.count,
      value: round2(s.value),
    })),
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
  }) as ReservationReport;
}

export interface GuestReport {
  range: DateRange;
  newGuests: number;
  totalGuests: number;
  returningGuests: number;
  vipGuests: number;
  averageSpend: number;
  byNationality: { nationality: string; count: number }[];
  byCountry: { country: string; count: number }[];
  topGuests: {
    _id: string;
    firstName: string;
    lastName: string;
    totalStays: number;
    totalSpend: number;
  }[];
}

export async function getGuestReport(range: DateRange): Promise<GuestReport> {
  const [newGuests, totalGuests, returning, vip, spend, byNationality, byCountry, topGuests] =
    await Promise.all([
      Guest.countDocuments({ createdAt: { $gte: range.from, $lt: range.to } }),
      Guest.countDocuments({}),
      // "Returning" means more than one completed stay on record.
      Guest.countDocuments({ totalStays: { $gt: 1 } }),
      Guest.countDocuments({ isVip: true }),
      Guest.aggregate<{ avg: number }>([
        { $match: { totalSpend: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$totalSpend" } } },
      ]),
      Guest.aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $ifNull: ["$nationality", "Unknown"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Guest.aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $ifNull: ["$country", "Unknown"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Guest.find({ totalSpend: { $gt: 0 } })
        .select("firstName lastName totalStays totalSpend")
        .sort({ totalSpend: -1 })
        .limit(10)
        .lean(),
    ]);

  return serialise({
    range,
    newGuests,
    totalGuests,
    returningGuests: returning,
    vipGuests: vip,
    averageSpend: round2(spend[0]?.avg ?? 0),
    byNationality: byNationality.map((n) => ({ nationality: n._id, count: n.count })),
    byCountry: byCountry.map((c) => ({ country: c._id, count: c.count })),
    topGuests,
  }) as unknown as GuestReport;
}
