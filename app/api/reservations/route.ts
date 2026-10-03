import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import {
  Guest,
  Payment,
  Reservation,
  Room,
  nextFormattedNumber,
} from "@/models";
import { createReservationSchema, reservationQuerySchema } from "@/schemas/reservation";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchReservations } from "@/lib/data";
import { assertRoomIsBookable, normaliseStayRange } from "@/lib/availability";
import { getHotelSettings } from "@/lib/settings";
import { calculateFolio } from "@/lib/pricing";
import { recalculateReservationTotals } from "@/lib/folio";
import { NotFoundError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("reservations:view");
    const query = reservationQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchReservations(query);
    return ok(data, "Reservations loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("reservations:create");
    const input = createReservationSchema.parse(await request.json());

    await connectToDatabase();
    const settings = await getHotelSettings();

    const range = normaliseStayRange({
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    });

    const room = await Room.findById(input.room).populate("roomType", "name").lean();
    if (!room) {
      throw new ValidationError("That room no longer exists", { room: "Select a room" });
    }

    await assertRoomIsBookable(input.room, range, {
      adults: input.adults,
      children: input.children,
    });

    // Resolve the guest: either an existing profile or a new one created inline.
    let guestId: string;
    if (input.guest) {
      const guest = await Guest.findById(input.guest).select("_id blacklisted").lean();
      if (!guest) {
        throw new ValidationError("That guest no longer exists", {
          guest: "Select a guest",
        });
      }
      if (guest.blacklisted) {
        throw new ValidationError("This guest is blacklisted and cannot be booked", {
          guest: "Guest is blacklisted",
        });
      }
      guestId = String(guest._id);
    } else {
      const newGuest = await Guest.create({ ...input.newGuest!, createdBy: actor.id });
      guestId = String(newGuest._id);
    }

    const pricePerNight = input.pricePerNight ?? room.pricePerNight;
    const taxPercent = input.taxPercent ?? settings.taxPercent;

    const folio = calculateFolio({
      checkInDate: range.checkInDate,
      checkOutDate: range.checkOutDate,
      pricePerNight,
      taxPercent,
      discount: input.discount,
    });

    const reservationNumber = await nextFormattedNumber("RSV");

    const reservation = await Reservation.create({
      reservationNumber,
      guest: new Types.ObjectId(guestId),
      room: room._id,
      roomType: room.roomType,
      checkInDate: range.checkInDate,
      checkOutDate: range.checkOutDate,
      adults: input.adults,
      children: input.children,
      numberOfNights: folio.numberOfNights,
      pricePerNight,
      roomCharges: folio.roomCharges,
      subtotal: folio.subtotal,
      taxPercent,
      tax: folio.tax,
      discount: folio.discount,
      totalAmount: folio.totalAmount,
      balanceDue: folio.totalAmount,
      paymentStatus: "UNPAID",
      reservationStatus: input.reservationStatus,
      preferredPaymentMethod: input.preferredPaymentMethod,
      source: input.source ?? "Front Desk",
      specialRequests: input.specialRequests,
      createdBy: actor.id,
    });

    /**
     * Mark the room RESERVED only while it is otherwise sellable. A room that is
     * currently OCCUPIED by an in-house guest stays OCCUPIED — the new booking is
     * for a later date and must not change today's board.
     */
    if (["AVAILABLE", "CLEANING"].includes(room.status)) {
      await Room.updateOne({ _id: room._id }, { $set: { status: "RESERVED" } });
    }

    // Optional deposit taken at booking time.
    if (input.initialPayment) {
      await Payment.create({
        paymentId: await nextFormattedNumber("PAY"),
        reservation: reservation._id,
        guest: new Types.ObjectId(guestId),
        kind: "PAYMENT",
        amount: input.initialPayment.amount,
        method: input.initialPayment.method,
        status: "COMPLETED",
        transactionId: input.initialPayment.transactionId,
        notes: input.initialPayment.notes ?? "Deposit taken at booking",
        paymentDate: new Date(),
        receivedBy: actor.id,
      });
    }

    await recalculateReservationTotals(reservation._id);

    const full = await Reservation.findById(reservation._id)
      .populate("guest", "firstName lastName email phone")
      .populate("room", "roomNumber floor")
      .populate("roomType", "name")
      .lean();
    if (!full) throw new NotFoundError("Reservation");

    return created(full, `Reservation ${reservationNumber} confirmed`);
  } catch (error) {
    return handleApiError(error);
  }
}
