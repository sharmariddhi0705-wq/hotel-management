import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GuestsTable, type GuestRow } from "@/components/guests/guests-table";
import { guestQuerySchema } from "@/schemas/guest";
import { fetchGuestCountries, fetchGuests } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Guests" };
export const dynamic = "force-dynamic";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("guests:view");
  const params = await searchParams;
  const query = parsePageParams(guestQuerySchema, params);

  const [{ data, meta }, countries, settings] = await Promise.all([
    fetchGuests(query),
    fetchGuestCountries(),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Guests"
        description={`${meta.total} guest profile(s) on record.`}
      />
      <GuestsTable
        guests={data as unknown as GuestRow[]}
        meta={meta}
        countries={countries}
        currency={settings.currency}
        locale={settings.locale}
        permissions={{
          create: can(user.role, "guests:create"),
          update: can(user.role, "guests:update"),
          remove: can(user.role, "guests:delete"),
        }}
        openNewOnMount={params.new === "1"}
      />
    </>
  );
}
