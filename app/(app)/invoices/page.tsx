import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicesTable, type InvoiceRow } from "@/components/invoices/invoices-table";
import { invoiceQuerySchema } from "@/schemas/payment";
import { fetchInvoices } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission("invoices:view");
  const query = parsePageParams(invoiceQuerySchema, await searchParams);

  const [{ data, meta }, settings] = await Promise.all([
    fetchInvoices(query),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={`${meta.total} invoice(s) issued. Open one to print or save it as a PDF.`}
      />
      <InvoicesTable
        invoices={data as unknown as InvoiceRow[]}
        meta={meta}
        currency={settings.currency}
        locale={settings.locale}
      />
    </>
  );
}
