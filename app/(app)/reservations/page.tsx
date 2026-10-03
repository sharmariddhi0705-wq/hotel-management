import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import {
  ReservationsTable,
  type ReservationRow,
} from "@/components/reservations/reservations-table";
import { reservationQuerySchema } from "@/schemas/reservation";
import { fetchReservations } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("reservations:view");
  const query = parsePageParams(reservationQuerySchema, await searchParams);

  const [{ data, meta }, settings] = await Promise.all([
    fetchReservations(query),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Reservations"
        description={`${meta.total} reservation(s) in this view.`}
      />
      <ReservationsTable
        reservations={data as unknown as ReservationRow[]}
        meta={meta}
        currency={settings.currency}
        locale={settings.locale}
        permissions={{
          create: can(user.role, "reservations:create"),
          cancel: can(user.role, "reservations:cancel"),
        }}
      />
    </>
  );
}
