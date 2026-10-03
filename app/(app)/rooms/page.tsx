import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RoomsTable } from "@/components/rooms/rooms-table";
import { roomQuerySchema } from "@/schemas/room";
import { fetchRoomFloors, fetchRooms, fetchRoomTypeOptions } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";
import type { RoomRow } from "@/components/rooms/rooms-table";
import type { RoomTypeOption } from "@/components/rooms/room-form";

export const metadata: Metadata = { title: "Rooms" };
export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("rooms:view");
  const params = await searchParams;
  const query = parsePageParams(roomQuerySchema, params);

  const [{ data, meta }, roomTypes, floors, settings] = await Promise.all([
    fetchRooms(query),
    fetchRoomTypeOptions(),
    fetchRoomFloors(),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Rooms"
        description={`${meta.total} room(s) on the floor plan at ${settings.hotelName}.`}
      />
      <RoomsTable
        rooms={data as unknown as RoomRow[]}
        meta={meta}
        roomTypes={roomTypes as unknown as RoomTypeOption[]}
        floors={floors}
        currency={settings.currency}
        locale={settings.locale}
        permissions={{
          create: can(user.role, "rooms:create"),
          update: can(user.role, "rooms:update"),
          remove: can(user.role, "rooms:delete"),
        }}
        openNewOnMount={params.new === "1"}
      />
    </>
  );
}
