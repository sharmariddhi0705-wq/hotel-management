import { Reservation, Room } from "@/models";

/**
 * Returns a room to AVAILABLE when nothing holds it any more.
 *
 * A room may be RESERVED on account of several future bookings, so it is only
 * released when no blocking reservation remains — and never while a guest is
 * still in house, or while the room is dirty, under maintenance or out of
 * service, since those states are about the room itself rather than the
 * calendar.
 */
export async function releaseRoomIfUnused(roomId: string): Promise<void> {
  const room = await Room.findById(roomId).select("status housekeepingStatus").lean();
  if (!room) return;
  if (!["RESERVED", "AVAILABLE"].includes(room.status)) return;

  const stillHeld = await Reservation.exists({
    room: roomId,
    reservationStatus: { $in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
  });
  if (stillHeld) return;

  const nextStatus = room.housekeepingStatus === "DIRTY" ? "CLEANING" : "AVAILABLE";
  await Room.updateOne({ _id: roomId }, { $set: { status: nextStatus } });
}

/** Holds a sellable room for a future booking. */
export async function holdRoomForReservation(roomId: string): Promise<void> {
  await Room.updateOne(
    { _id: roomId, status: { $in: ["AVAILABLE", "CLEANING"] } },
    { $set: { status: "RESERVED" } },
  );
}
