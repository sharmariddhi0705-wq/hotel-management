import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { availabilityQuerySchema } from "@/schemas/room";
import { findAvailableRooms, normaliseStayRange } from "@/lib/availability";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { nightsBetween } from "@/lib/dates";

/**
 * Availability search for step 2 of the reservation wizard.
 *
 * Returns only rooms that are bookable for the whole range and large enough for
 * the party, together with the computed stay length so the client can price it
 * without re-deriving the night count.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reservations:create");
    const query = availabilityQuerySchema.parse(searchParamsToObject(request));

    await connectToDatabase();

    const range = normaliseStayRange({
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
    });

    const rooms = await findAvailableRooms({
      range,
      adults: query.adults,
      children: query.children,
      roomTypeId: query.roomType,
      excludeReservationId: query.excludeReservation,
    });

    return ok(
      {
        checkInDate: range.checkInDate,
        checkOutDate: range.checkOutDate,
        numberOfNights: nightsBetween(range.checkInDate, range.checkOutDate),
        rooms,
      },
      rooms.length === 0
        ? "No rooms are free for those dates"
        : `${rooms.length} room(s) available`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
