import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsView } from "@/components/reports/reports-view";
import { Skeleton } from "@/components/ui/skeleton";
import { reportQuerySchema } from "@/schemas/report";
import {
  getGuestReport,
  getOccupancyReport,
  getReservationReport,
  getRevenueReport,
  resolveRange,
} from "@/lib/reports";
import { connectToDatabase } from "@/lib/mongodb";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";
import { toDateInputValue } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission("reports:view");
  const query = parsePageParams(reportQuerySchema, await searchParams);

  await connectToDatabase();
  const range = resolveRange(query);
  const settings = await getHotelSettings();

  /**
   * Only the selected report is computed. Running all four on every page load
   * would quadruple the aggregation work for figures nobody is looking at.
   */
  const [revenue, occupancy, reservations, guests] = await Promise.all([
    query.type === "revenue" ? getRevenueReport(range) : undefined,
    query.type === "occupancy" ? getOccupancyReport(range) : undefined,
    query.type === "reservations" ? getReservationReport(range) : undefined,
    query.type === "guests" ? getGuestReport(range) : undefined,
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${range.label} · exports use the same figures shown here.`}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportsView
          type={query.type}
          preset={query.preset}
          from={toDateInputValue(query.from)}
          to={toDateInputValue(query.to)}
          currency={settings.currency}
          locale={settings.locale}
          revenue={revenue}
          occupancy={occupancy}
          reservations={reservations}
          guests={guests}
        />
      </Suspense>
    </>
  );
}
