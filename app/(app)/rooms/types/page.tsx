import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RoomTypesManager, type RoomTypeRow } from "@/components/rooms/room-types-manager";
import { paginationSchema } from "@/schemas/common";
import { fetchRoomTypes } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Room types" };
export const dynamic = "force-dynamic";

export default async function RoomTypesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("roomTypes:view");
  const query = parsePageParams(paginationSchema, await searchParams);

  const [{ data, meta }, settings] = await Promise.all([
    fetchRoomTypes(query),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Room types"
        description="Rate categories that rooms inherit their base price and occupancy from."
      />
      <RoomTypesManager
        roomTypes={data as unknown as RoomTypeRow[]}
        meta={meta}
        currency={settings.currency}
        locale={settings.locale}
        canManage={can(user.role, "roomTypes:manage")}
      />
    </>
  );
}
