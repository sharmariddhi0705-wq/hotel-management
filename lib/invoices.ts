import { Types, type ClientSession, type HydratedDocument } from "mongoose";
import { Invoice, Reservation, nextFormattedNumber, type IInvoice } from "@/models";
import { getHotelSettings } from "@/lib/settings";
import { buildInvoiceLines, sumPayments } from "@/lib/folio";
import { round2 } from "@/lib/pricing";
import { NotFoundError } from "@/lib/errors";

/**
 * Invoice issuing.
 *
 * Generating an invoice freezes the hotel, guest and stay details at that
 * moment (see the snapshot fields on the model). Re-issuing for the same
 * reservation returns the existing invoice rather than creating a duplicate,
 * which keeps check-out idempotent if the desk clicks twice.
 */
export async function issueInvoiceForReservation(
  reservationId: string | Types.ObjectId,
  options: { issuedBy?: string | null; notes?: string; session?: ClientSession | null } = {},
): Promise<HydratedDocument<IInvoice>> {
  const { issuedBy, notes, session } = options;

  const existingQuery = Invoice.findOne({ reservation: reservationId });
  if (session) existingQuery.session(session);
  const existing = await existingQuery.exec();
  if (existing) return existing;

  const reservationQuery = Reservation.findById(reservationId)
    .populate("guest")
    .populate("room", "roomNumber floor")
    .populate("roomType", "name");
  if (session) reservationQuery.session(session);
  const reservation = await reservationQuery.exec();
  if (!reservation) throw new NotFoundError("Reservation");

  const settings = await getHotelSettings();
  const { methods } = await sumPayments(reservation._id, session);

  // Populated docs: cast to the shapes we asked for above.
  const guest = reservation.guest as unknown as {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
    nationality?: string;
  };
  const room = reservation.room as unknown as { roomNumber: string };
  const roomType = reservation.roomType as unknown as { name: string };

  const additionalCharges = round2(
    reservation.additionalCharges.reduce(
      (sum, c) => sum + c.amount * (c.quantity || 1),
      0,
    ),
  );

  const invoiceNumber = await nextFormattedNumber(settings.invoicePrefix || "INV");

  const [invoice] = await Invoice.create(
    [
      {
        invoiceNumber,
        reservation: reservation._id,
        guest: guest._id,
        invoiceDate: new Date(),
        hotelSnapshot: {
          name: settings.hotelName,
          address: [settings.address, settings.city, settings.state, settings.postalCode]
            .filter(Boolean)
            .join(", "),
          city: settings.city,
          country: settings.country,
          phone: settings.phone,
          email: settings.email,
          taxId: settings.taxId,
          currency: settings.currency,
          currencySymbol: settings.currencySymbol,
        },
        guestSnapshot: {
          name: `${guest.firstName} ${guest.lastName}`.trim(),
          email: guest.email,
          phone: guest.phone,
          address: [guest.address, guest.city, guest.country].filter(Boolean).join(", "),
          idType: reservation.idTypeRecorded ?? guest.idType,
          idNumber: reservation.idNumberRecorded ?? guest.idNumber,
          nationality: guest.nationality,
        },
        staySnapshot: {
          roomNumber: room.roomNumber,
          roomTypeName: roomType.name,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          actualCheckInTime: reservation.actualCheckInTime,
          actualCheckOutTime: reservation.actualCheckOutTime,
          numberOfNights: reservation.numberOfNights,
          adults: reservation.adults,
          children: reservation.children,
        },
        lines: buildInvoiceLines(reservation),
        roomCharges: reservation.roomCharges,
        additionalCharges,
        subtotal: reservation.subtotal,
        discount: reservation.discount,
        taxPercent: reservation.taxPercent,
        tax: reservation.tax,
        totalAmount: reservation.totalAmount,
        amountPaid: reservation.amountPaid,
        balanceDue: reservation.balanceDue,
        status:
          reservation.balanceDue <= 0
            ? "PAID"
            : reservation.amountPaid > 0
              ? "PARTIALLY_PAID"
              : "ISSUED",
        paymentMethods: methods,
        notes,
        issuedBy: issuedBy ? new Types.ObjectId(issuedBy) : null,
      },
    ],
    session ? { session } : {},
  );

  return invoice;
}
