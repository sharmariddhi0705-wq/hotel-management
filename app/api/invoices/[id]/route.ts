import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Invoice, Payment } from "@/models";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("invoices:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const invoice = await Invoice.findById(id)
      .populate("reservation", "reservationNumber reservationStatus additionalCharges")
      .lean();
    if (!invoice) throw new NotFoundError("Invoice");

    const payments = await Payment.find({ reservation: invoice.reservation })
      .select("paymentId kind amount method status paymentDate transactionId")
      .sort({ paymentDate: 1 })
      .lean();

    return ok({ invoice, payments }, "Invoice loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

/** Voids an invoice. Paid invoices are immutable records and cannot be voided. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("invoices:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const invoice = await Invoice.findById(id).select("invoiceNumber status amountPaid");
    if (!invoice) throw new NotFoundError("Invoice");

    if (invoice.amountPaid > 0) {
      throw new ConflictError(
        `Invoice ${invoice.invoiceNumber} has payments against it. Refund them before voiding.`,
      );
    }

    invoice.status = "CANCELLED";
    await invoice.save();

    return ok({ id }, `Invoice ${invoice.invoiceNumber} voided`);
  } catch (error) {
    return handleApiError(error);
  }
}
