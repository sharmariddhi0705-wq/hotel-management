import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CheckInPanel, type ArrivalRow } from "@/components/reservations/check-in-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Reservation } from "@/models";
import { serialise } from "@/lib/query";
import { getHotelSettings } from "@/lib/settings";
import { addDays, todayUtc } from "@/lib/dates";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  await requirePermission("checkin:manage");
  await connectToDatabase();

  const today = todayUtc();

  /**
   * Arrivals due today, plus any that are overdue — a guest who did not show up
   * yesterday can still walk in this morning, and the desk needs to see them.
   */
  const [arrivals, settings] = await Promise.all([
    Reservation.find({
      reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
      checkInDate: { $lte: addDays(today, 1) },
      checkOutDate: { $gt: today },
    })
      .populate("guest", "firstName lastName phone email idType idNumber isVip")
      .populate("room", "roomNumber floor status housekeepingStatus")
      .populate("roomType", "name")
      .sort({ checkInDate: 1 })
      .limit(100)
      .lean(),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Check-in"
        description={`${arrivals.length} arrival(s) expected. Verify the guest, record their ID and confirm.`}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CheckInPanel
          arrivals={serialise(arrivals) as unknown as ArrivalRow[]}
          currency={settings.currency}
          locale={settings.locale}
          checkInTime={settings.checkInTime}
        />
      </Suspense>
    </>
  );
}
