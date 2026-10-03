import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Crown,
  IdCard,
  MapPin,
  NotebookPen,
  Phone,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { GuestActions } from "@/components/guests/guest-actions";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import { Guest, Payment, Reservation } from "@/models";
import { serialise } from "@/lib/query";
import { objectIdSchema } from "@/schemas/common";
import { getHotelSettings } from "@/lib/settings";
import { formatCurrency, formatDateTime, formatStayDate } from "@/lib/format";
import { label } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) return { title: "Guest" };

  await connectToDatabase();
  const guest = await Guest.findById(id).select("firstName lastName").lean();
  return { title: guest ? `${guest.firstName} ${guest.lastName}` : "Guest" };
}

interface GuestDetail {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: string | null;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  notes?: string;
  isVip: boolean;
  blacklisted: boolean;
  totalStays: number;
  totalSpend: number;
  createdAt: string;
}

interface StayRow {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  totalAmount: number;
  balanceDue: number;
  reservationStatus: string;
  paymentStatus: string;
  room?: { roomNumber: string } | null;
  roomType?: { name: string } | null;
}

interface PaymentRow {
  _id: string;
  paymentId: string;
  kind: string;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
  reservation?: { reservationNumber: string } | null;
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("guests:view");
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await connectToDatabase();

  const [guestDoc, stayDocs, paymentDocs, settings] = await Promise.all([
    Guest.findById(id).lean(),
    Reservation.find({ guest: id })
      .populate("room", "roomNumber")
      .populate("roomType", "name")
      .sort({ checkInDate: -1 })
      .limit(50)
      .lean(),
    Payment.find({ guest: id })
      .populate("reservation", "reservationNumber")
      .sort({ paymentDate: -1 })
      .limit(50)
      .lean(),
    getHotelSettings(),
  ]);

  if (!guestDoc) notFound();

  const guest = serialise(guestDoc) as unknown as GuestDetail;
  const stays = serialise(stayDocs) as unknown as StayRow[];
  const payments = serialise(paymentDocs) as unknown as PaymentRow[];
  const money = { currency: settings.currency, locale: settings.locale };

  const outstanding = stays.reduce((sum, stay) => sum + (stay.balanceDue ?? 0), 0);
  const upcoming = stays.filter((s) =>
    ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(s.reservationStatus),
  ).length;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/guests">
          <ArrowLeft className="size-4" />
          All guests
        </Link>
      </Button>

      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        description={`Guest since ${formatStayDate(guest.createdAt, settings.locale)}`}
        actions={
          <>
            {guest.isVip && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Crown className="size-3" />
                VIP
              </Badge>
            )}
            {guest.blacklisted && <Badge variant="destructive">Blacklisted</Badge>}
            {can(user.role, "guests:update") && <GuestActions guest={guest} />}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed stays"
          value={guest.totalStays}
          icon={IdCard}
          hint={`${upcoming} upcoming or in house`}
        />
        <StatCard
          label="Lifetime spend"
          value={formatCurrency(guest.totalSpend, money)}
          icon={CreditCard}
          tone="positive"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding, money)}
          icon={CreditCard}
          tone={outstanding > 0 ? "critical" : "positive"}
          hint="Across open folios"
        />
        <StatCard
          label="Payments on file"
          value={payments.length}
          icon={CreditCard}
          hint="Most recent 50"
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Phone" value={guest.phone} />
              <Row label="Email" value={guest.email ?? "—"} />
              <Row label="Nationality" value={guest.nationality ?? "—"} />
              <Row label="Gender" value={label(guest.gender)} />
              <Row
                label="Date of birth"
                value={formatStayDate(guest.dateOfBirth, settings.locale)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" />
              Address & identification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Address" value={guest.address ?? "—"} />
              <Row
                label="City / state"
                value={[guest.city, guest.state].filter(Boolean).join(", ") || "—"}
              />
              <Row
                label="Country"
                value={[guest.country, guest.postalCode].filter(Boolean).join(" ") || "—"}
              />
              <Row label="ID type" value={label(guest.idType)} />
              <Row label="ID number" value={guest.idNumber ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="size-4" />
              Internal notes
            </CardTitle>
            <CardDescription>Visible to staff only.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {guest.notes || "No notes recorded for this guest."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="text-base">Reservation history</CardTitle>
          <CardDescription>Most recent 50 stays, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {stays.length === 0 ? (
            <EmptyState title="No reservations yet" description="This guest has not booked." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Stay</TableHead>
                    <TableHead className="text-right">Nights</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stays.map((stay) => (
                    <TableRow key={stay._id}>
                      <TableCell>
                        <Link
                          href={`/reservations/${stay._id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {stay.reservationNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stay.room?.roomNumber ?? "—"}
                        {stay.roomType?.name ? ` · ${stay.roomType.name}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatStayDate(stay.checkInDate, settings.locale)} →{" "}
                        {formatStayDate(stay.checkOutDate, settings.locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stay.numberOfNights}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(stay.totalAmount, money)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stay.balanceDue > 0
                          ? formatCurrency(stay.balanceDue, money)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={stay.reservationStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={stay.paymentStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
          <CardDescription>Money received from and returned to this guest.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" description="Settlements appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-medium">{payment.paymentId}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.reservation?.reservationNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(payment.paymentDate, settings.locale)}
                      </TableCell>
                      <TableCell>{label(payment.method)}</TableCell>
                      <TableCell
                        className={
                          payment.kind === "REFUND"
                            ? "text-right tabular-nums text-rose-600 dark:text-rose-400"
                            : "text-right tabular-nums"
                        }
                      >
                        {payment.kind === "REFUND" ? "−" : ""}
                        {formatCurrency(payment.amount, money)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
