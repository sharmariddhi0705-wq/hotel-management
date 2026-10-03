import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CheckOutPanel, type DepartureRow } from "@/components/reservations/check-out-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Reservation } from "@/models";
import { serialise } from "@/lib/query";
import { getHotelSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Check-out" };
export const dynamic = "force-dynamic";

export default async function CheckOutPage() {
  await requirePermission("checkout:manage");
  await connectToDatabase();

  // Everyone in house, with those departing soonest first.
  const [departures, settings] = await Promise.all([
    Reservation.find({ reservationStatus: "CHECKED_IN" })
      .populate("guest", "firstName lastName phone")
      .populate("room", "roomNumber floor")
      .populate("roomType", "name")
      .sort({ checkOutDate: 1 })
      .limit(100)
      .lean(),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Check-out"
        description={`${departures.length} guest(s) in house. Settle the folio and close the stay.`}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CheckOutPanel
          departures={serialise(departures) as unknown as DepartureRow[]}
          currency={settings.currency}
          locale={settings.locale}
          checkOutTime={settings.checkOutTime}
        />
      </Suspense>
    </>
  );
}
