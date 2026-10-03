import { Types } from "mongoose";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/constants";
import { startOfUtcDay } from "@/lib/dates";
import { Reservation, Room } from "@/models";
import { BookingConflictError, ValidationError } from "@/lib/errors";

/**
 * Room availability and double-booking prevention.
 *
 * Every reservation occupies the half-open interval [checkIn, checkOut). Two
 * reservations clash when `existing.checkInDate < requested.checkOutDate` and
 * `requested.checkInDate < existing.checkOutDate`. Expressed as a MongoDB
 * query that is simply `checkInDate < newOut AND checkOutDate > newIn`, which
 * the compound index on `{ room, reservationStatus, checkInDate, checkOutDate }`
 * serves directly.
 */

export interface StayRange {
  checkInDate: Date;
  checkOutDate: Date;
}

export function normaliseStayRange(range: StayRange): StayRange {
  const checkInDate = startOfUtcDay(range.checkInDate);
  const checkOutDate = startOfUtcDay(range.checkOutDate);
  if (checkOutDate <= checkInDate) {
    throw new ValidationError("Check-out must be at least one night after check-in", {
      checkOutDate: "Check-out must be after check-in",
    });
  }
  return { checkInDate, checkOutDate };
}

/** The Mongo filter that matches any reservation clashing with `range`. */
export function overlapFilter(range: StayRange, excludeReservationId?: string) {
  const filter: Record<string, unknown> = {
    reservationStatus: { $in: BLOCKING_RESERVATION_STATUSES },
    checkInDate: { $lt: range.checkOutDate },
    checkOutDate: { $gt: range.checkInDate },
  };
  if (excludeReservationId && Types.ObjectId.isValid(excludeReservationId)) {
    filter._id = { $ne: new Types.ObjectId(excludeReservationId) };
  }
  return filter;
}

/** Ids of every room that is booked at any point during `range`. */
export async function findBookedRoomIds(
  range: StayRange,
  excludeReservationId?: string,
): Promise<string[]> {
  const rows = await Reservation.find(overlapFilter(range, excludeReservationId))
    .select("room")
    .lean();
  return rows.map((r) => String(r.room));
}

export interface ConflictInfo {
  reservationNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  reservationStatus: string;
}

/** Returns the clashing reservation for a specific room, or null. */
export async function findConflictingReservation(
  roomId: string,
  range: StayRange,
  excludeReservationId?: string,
): Promise<ConflictInfo | null> {
  const conflict = await Reservation.findOne({
    room: new Types.ObjectId(roomId),
    ...overlapFilter(range, excludeReservationId),
  })
    .select("reservationNumber checkInDate checkOutDate reservationStatus")
    .lean();

  if (!conflict) return null;
  return {
    reservationNumber: conflict.reservationNumber,
    checkInDate: conflict.checkInDate,
    checkOutDate: conflict.checkOutDate,
    reservationStatus: conflict.reservationStatus,
  };
}

/**
 * Throws unless `roomId` is free for the whole range.
 *
 * Called immediately before every reservation insert and update. MongoDB has no
 * range-exclusion constraint, so this check plus the retry in
 * `assertRoomIsBookable` is what enforces the invariant.
 */
export async function assertRoomIsFree(
  roomId: string,
  range: StayRange,
  excludeReservationId?: string,
): Promise<void> {
  const conflict = await findConflictingReservation(roomId, range, excludeReservationId);
  if (conflict) {
    throw new BookingConflictError(
      `Room already has reservation ${conflict.reservationNumber} from ` +
        `${conflict.checkInDate.toISOString().slice(0, 10)} to ` +
        `${conflict.checkOutDate.toISOString().slice(0, 10)}`,
      conflict,
    );
  }
}

/** Room statuses that may never accept a new booking. */
const UNBOOKABLE_STATUSES = ["MAINTENANCE", "OUT_OF_SERVICE"];

export async function assertRoomIsBookable(
  roomId: string,
  range: StayRange,
  opts: { excludeReservationId?: string; adults?: number; children?: number } = {},
): Promise<void> {
  if (!Types.ObjectId.isValid(roomId)) {
    throw new ValidationError("That room id is not valid", { room: "Select a room" });
  }

  const room = await Room.findById(roomId).select("roomNumber status isActive maxOccupancy").lean();
  if (!room) {
    throw new ValidationError("That room no longer exists", { room: "Select a room" });
  }
  if (!room.isActive) {
    throw new ValidationError(`Room ${room.roomNumber} is not in service`, {
      room: "This room is inactive",
    });
  }
  if (UNBOOKABLE_STATUSES.includes(room.status)) {
    throw new ValidationError(
      `Room ${room.roomNumber} is marked ${room.status.toLowerCase().replace(/_/g, " ")}`,
      { room: "This room cannot be booked right now" },
    );
  }

  const guests = (opts.adults ?? 1) + (opts.children ?? 0);
  if (guests > room.maxOccupancy) {
    throw new ValidationError(
      `Room ${room.roomNumber} sleeps ${room.maxOccupancy}; you selected ${guests} guests`,
      { adults: `This room sleeps at most ${room.maxOccupancy}` },
    );
  }

  await assertRoomIsFree(roomId, range, opts.excludeReservationId);
}

/** Rooms that are bookable for the requested stay, newest search first. */
export async function findAvailableRooms(params: {
  range: StayRange;
  adults: number;
  children: number;
  roomTypeId?: string;
  excludeReservationId?: string;
}) {
  const { range, adults, children, roomTypeId, excludeReservationId } = params;
  const bookedIds = await findBookedRoomIds(range, excludeReservationId);
  const occupancy = adults + children;

  const filter: Record<string, unknown> = {
    isActive: true,
    status: { $nin: UNBOOKABLE_STATUSES },
    maxOccupancy: { $gte: occupancy },
    _id: { $nin: bookedIds.map((id) => new Types.ObjectId(id)) },
  };
  if (roomTypeId && Types.ObjectId.isValid(roomTypeId)) {
    filter.roomType = new Types.ObjectId(roomTypeId);
  }

  return Room.find(filter)
    .populate("roomType", "name slug basePrice capacityAdults capacityChildren amenities")
    .sort({ pricePerNight: 1, roomNumber: 1 })
    .lean();
}
