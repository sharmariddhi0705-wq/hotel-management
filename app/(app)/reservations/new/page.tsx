import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { BookingWizard, type RoomTypeChoice } from "@/components/reservations/booking-wizard";
import { fetchRoomTypeOptions } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "New reservation" };
export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  await requirePermission("reservations:create");

  const [roomTypes, settings] = await Promise.all([
    fetchRoomTypeOptions(),
    getHotelSettings(),
  ]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/reservations">
          <ArrowLeft className="size-4" />
          All reservations
        </Link>
      </Button>

      <PageHeader
        title="New reservation"
        description="Check availability, choose a room, attach the guest and take a deposit."
      />

      <BookingWizard
        roomTypes={roomTypes as unknown as RoomTypeChoice[]}
        taxPercent={settings.taxPercent}
        currency={settings.currency}
        locale={settings.locale}
        checkInTime={settings.checkInTime}
        checkOutTime={settings.checkOutTime}
      />
    </>
  );
}
