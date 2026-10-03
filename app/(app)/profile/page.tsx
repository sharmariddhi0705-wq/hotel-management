import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { requireUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { getHotelSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/constants";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const actor = await requireUser();
  await connectToDatabase();

  const [account, settings] = await Promise.all([
    User.findById(actor.id)
      .select("name email role status phone lastLoginAt createdAt")
      .populate("staff", "employeeId department designation")
      .lean(),
    getHotelSettings(),
  ]);

  // What this role is actually allowed to do, read from the same map the server enforces.
  const granted = (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    (PERMISSIONS[permission] as readonly string[]).includes(actor.role),
  );

  return (
    <>
      <PageHeader
        title="My profile"
        description={`Your account at ${settings.hotelName}.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Name" value={account?.name ?? actor.name} />
              <Row label="Email" value={account?.email ?? actor.email} />
              <Row label="Role" value={label(actor.role)} />
              <Row label="Status" value={label(account?.status ?? actor.status)} />
              <Row label="Phone" value={account?.phone ?? "—"} />
              <Row
                label="Last signed in"
                value={formatDateTime(account?.lastLoginAt, settings.locale)}
              />
              <Row
                label="Account created"
                value={formatDateTime(account?.createdAt, settings.locale)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-3 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">What your role can do</CardTitle>
            <CardDescription>
              {granted.length} permission(s). These are enforced on the server for every
              request, not just in the sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {granted.map((permission) => (
                <Badge key={permission} variant="secondary">
                  {permission}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 max-w-2xl">
        <ChangePasswordForm />
      </div>
    </>
  );
}

function Row({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{rowLabel}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}
