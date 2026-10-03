import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import {
  PaymentsSummary,
  PaymentsTable,
  type PaymentRow,
} from "@/components/payments/payments-table";
import { paymentQuerySchema } from "@/schemas/payment";
import { fetchPayments } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission("payments:view");
  const query = parsePageParams(paymentQuerySchema, await searchParams);

  const [{ data, meta, summary }, settings] = await Promise.all([
    fetchPayments(query),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Payments"
        description={`${meta.total} transaction(s) recorded.`}
      />
      <PaymentsSummary
        summary={summary}
        currency={settings.currency}
        locale={settings.locale}
      />
      <PaymentsTable
        payments={data as unknown as PaymentRow[]}
        meta={meta}
        currency={settings.currency}
        locale={settings.locale}
      />
    </>
  );
}
