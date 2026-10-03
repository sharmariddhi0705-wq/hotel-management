import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { createInvoiceSchema, invoiceQuerySchema } from "@/schemas/payment";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchInvoices } from "@/lib/data";
import { issueInvoiceForReservation } from "@/lib/invoices";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("invoices:view");
    const query = invoiceQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchInvoices(query);
    return ok(data, "Invoices loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("invoices:manage");
    const input = createInvoiceSchema.parse(await request.json());

    await connectToDatabase();
    const invoice = await issueInvoiceForReservation(input.reservation, {
      issuedBy: actor.id,
      notes: input.notes,
    });

    return created(invoice.toObject(), `Invoice ${invoice.invoiceNumber} ready`);
  } catch (error) {
    return handleApiError(error);
  }
}
