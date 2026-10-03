import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  InvoiceSheet,
  type InvoiceDocument,
} from "@/components/invoices/invoice-sheet";
import { requirePermission } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Invoice, Payment } from "@/models";
import { serialise } from "@/lib/query";
import { objectIdSchema } from "@/schemas/common";
import { getHotelSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) return { title: "Invoice" };

  await connectToDatabase();
  const invoice = await Invoice.findById(id).select("invoiceNumber").lean();
  return { title: invoice?.invoiceNumber ?? "Invoice" };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("invoices:view");
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await connectToDatabase();
  const invoiceDoc = await Invoice.findById(id).lean();
  if (!invoiceDoc) notFound();

  const [paymentDocs, settings] = await Promise.all([
    Payment.find({ reservation: invoiceDoc.reservation, status: "COMPLETED" })
      .select("paymentId kind amount method status paymentDate")
      .sort({ paymentDate: 1 })
      .lean(),
    getHotelSettings(),
  ]);

  const invoice = serialise(invoiceDoc) as unknown as InvoiceDocument;

  return (
    <>
      <div className="no-print">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href="/invoices">
            <ArrowLeft className="size-4" />
            All invoices
          </Link>
        </Button>
        <PageHeader
          title={invoice.invoiceNumber}
          description={`Issued to ${invoice.guestSnapshot.name} for room ${invoice.staySnapshot.roomNumber}.`}
        />
      </div>

      <InvoiceSheet
        invoice={invoice}
        payments={serialise(paymentDocs) as never}
        locale={settings.locale}
        invoiceFooter={settings.invoiceFooter}
      />
    </>
  );
}
