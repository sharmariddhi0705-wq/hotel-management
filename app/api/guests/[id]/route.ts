import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Guest, Payment, Reservation } from "@/models";
import { updateGuestSchema } from "@/schemas/guest";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("guests:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();

    const [guest, reservations, payments] = await Promise.all([
      Guest.findById(id).lean(),
      Reservation.find({ guest: id })
        .populate("room", "roomNumber floor")
        .populate("roomType", "name")
        .sort({ checkInDate: -1 })
        .limit(50)
        .lean(),
      Payment.find({ guest: id })
        .populate("reservation", "reservationNumber")
        .sort({ paymentDate: -1 })
        .limit(50)
        .lean(),
    ]);

    if (!guest) throw new NotFoundError("Guest");

    return ok({ guest, reservations, payments }, "Guest loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("guests:update");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateGuestSchema.parse(await request.json());

    await connectToDatabase();
    const guest = await Guest.findById(id);
    if (!guest) throw new NotFoundError("Guest");

    if (input.email && input.email !== guest.email) {
      const clash = await Guest.findOne({ email: input.email, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (clash) throw new ConflictError("A guest with that email already exists");
    }

    Object.assign(guest, input);
    await guest.save();

    return ok(guest.toObject(), "Guest updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("guests:delete");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const guest = await Guest.findById(id).select("firstName lastName");
    if (!guest) throw new NotFoundError("Guest");

    const active = await Reservation.countDocuments({
      guest: id,
      reservationStatus: { $in: BLOCKING_RESERVATION_STATUSES },
    });
    if (active > 0) {
      throw new ConflictError(
        `This guest has ${active} active reservation(s). Cancel or complete them first.`,
      );
    }

    // Past stays are financial records; keep the profile they point at.
    const history = await Reservation.countDocuments({ guest: id });
    if (history > 0) {
      throw new ConflictError(
        "This guest has stay history and cannot be deleted. Their records are needed for past invoices.",
      );
    }

    await guest.deleteOne();
    return ok({ id }, `${guest.firstName} ${guest.lastName} removed`);
  } catch (error) {
    return handleApiError(error);
  }
}
