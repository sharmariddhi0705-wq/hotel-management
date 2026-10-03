import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import {
  UsersManager,
  type StaffOption,
  type UserRow,
} from "@/components/users/users-manager";
import { userQuerySchema } from "@/schemas/user";
import { fetchUsers } from "@/lib/data";
import { connectToDatabase } from "@/lib/mongodb";
import { Staff } from "@/models";
import { serialise } from "@/lib/query";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { parsePageParams, type RawSearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Users & Roles" };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const actor = await requirePermission("users:view");
  const query = parsePageParams(userQuerySchema, await searchParams);

  await connectToDatabase();

  const [{ data, meta }, staff, settings] = await Promise.all([
    fetchUsers(query),
    Staff.find({ status: "ACTIVE" })
      .select("firstName lastName employeeId department")
      .sort({ firstName: 1 })
      .lean(),
    getHotelSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description={`${meta.total} login account(s). Roles are enforced on the server for every request.`}
      />
      <UsersManager
        users={data as unknown as UserRow[]}
        meta={meta}
        staff={serialise(staff) as unknown as StaffOption[]}
        currentUserId={actor.id}
        locale={settings.locale}
      />
    </>
  );
}
