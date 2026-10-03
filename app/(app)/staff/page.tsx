import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StaffManager, type StaffRow } from "@/components/staff/staff-manager";
import { staffQuerySchema } from "@/schemas/staff";
import { fetchStaff } from "@/lib/data";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requirePermission("staff:view");
  const query = parsePageParams(staffQuerySchema, await searchParams);

  const [{ data, meta }, settings] = await Promise.all([
    fetchStaff(query),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Staff"
        description={`${meta.total} staff record(s) across all departments.`}
      />
      <StaffManager
        staff={data as unknown as StaffRow[]}
        meta={meta}
        locale={settings.locale}
        permissions={{
          manage: can(user.role, "staff:manage"),
          remove: can(user.role, "staff:delete"),
        }}
      />
    </>
  );
}
