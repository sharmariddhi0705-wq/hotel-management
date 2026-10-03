import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Reservation } from "@/models";
import { additionalChargeSchema } from "@/schemas/reservation";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { recalculateReservationTotals } from "@/lib/folio";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

/** Posts an extra charge (minibar, laundry, late checkout) to a folio. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("reservations:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = additionalChargeSchema.parse(await request.json());

    await connectToDatabase();
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new NotFoundError("Reservation");

    if (["CANCELLED", "NO_SHOW"].includes(reservation.reservationStatus)) {
      throw new ConflictError("Charges cannot be added to a cancelled reservation");
    }
    if (reservation.reservationStatus === "CHECKED_OUT") {
      throw new ConflictError(
        "This stay is closed. Add the charge before check-out, or record a separate payment.",
      );
    }

    reservation.additionalCharges.push({
      description: input.description,
      amount: input.amount,
      quantity: input.quantity,
      addedAt: new Date(),
      addedBy: new Types.ObjectId(actor.id),
    });
    await reservation.save();

    const totals = await recalculateReservationTotals(reservation._id);
    return created({ totals }, `${input.description} added to the folio`);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Removes a charge that was posted in error. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("reservations:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const chargeId = request.nextUrl.searchParams.get("chargeId");
    if (!chargeId) {
      return handleApiError(new ConflictError("Which charge should be removed?"));
    }
    objectIdSchema.parse(chargeId);

    await connectToDatabase();
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new NotFoundError("Reservation");
    if (reservation.reservationStatus === "CHECKED_OUT") {
      throw new ConflictError("This stay is closed and its charges are final");
    }

    const before = reservation.additionalCharges.length;
    reservation.additionalCharges = reservation.additionalCharges.filter(
      (charge) => String(charge._id) !== chargeId,
    ) as typeof reservation.additionalCharges;

    if (reservation.additionalCharges.length === before) {
      throw new NotFoundError("Charge");
    }

    await reservation.save();
    const totals = await recalculateReservationTotals(reservation._id);

    return ok({ totals }, "Charge removed");
  } catch (error) {
    return handleApiError(error);
  }
}
