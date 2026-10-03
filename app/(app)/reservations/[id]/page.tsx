import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  CreditCard,
  FileText,
  IdCard,
  NotebookPen,
  Receipt,
  UserRound,
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
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FolioPanel, type FolioCharge } from "@/components/reservations/folio-panel";
import { ReservationActions } from "@/components/reservations/reservation-actions";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import { Invoice, Payment, Reservation } from "@/models";
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
  if (!objectIdSchema.safeParse(id).success) return { title: "Reservation" };

  await connectToDatabase();
  const reservation = await Reservation.findById(id).select("reservationNumber").lean();
  return { title: reservation?.reservationNumber ?? "Reservation" };
}

interface ReservationDetail {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  numberOfNights: number;
  pricePerNight: number;
  roomCharges: number;
  additionalCharges: FolioCharge[];
  subtotal: number;
  taxPercent: number;
  tax: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  balanceDue: number;
  paymentStatus: string;
  reservationStatus: string;
  preferredPaymentMethod?: string;
  source: string;
  specialRequests?: string;
  actualCheckInTime?: string | null;
  actualCheckOutTime?: string | null;
  idVerified: boolean;
  idTypeRecorded?: string;
  idNumberRecorded?: string;
  cancellationReason?: string;
  cancelledAt?: string | null;
  createdAt: string;
  guest?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    nationality?: string;
    isVip?: boolean;
  } | null;
  room?: { _id: string; roomNumber: string; floor: number; status: string } | null;
  roomType?: { name: string } | null;
  createdBy?: { name: string } | null;
  checkedInBy?: { name: string } | null;
  checkedOutBy?: { name: string } | null;
}

interface PaymentRow {
  _id: string;
  paymentId: string;
  kind: string;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
  transactionId?: string;
  notes?: string;
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("reservations:view");
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await connectToDatabase();

  const [reservationDoc, paymentDocs, invoiceDoc, settings] = await Promise.all([
    Reservation.findById(id)
      .populate("guest", "firstName lastName email phone nationality isVip")
      .populate("room", "roomNumber floor status")
      .populate("roomType", "name")
      .populate("createdBy", "name")
      .populate("checkedInBy", "name")
      .populate("checkedOutBy", "name")
      .lean(),
    Payment.find({ reservation: id }).sort({ paymentDate: -1 }).lean(),
    Invoice.findOne({ reservation: id })
      .select("invoiceNumber status totalAmount balanceDue")
      .lean(),
    getHotelSettings(),
  ]);

  if (!reservationDoc) notFound();

  const reservation = serialise(reservationDoc) as unknown as ReservationDetail;
  const payments = serialise(paymentDocs) as unknown as PaymentRow[];
  const invoice = invoiceDoc
    ? (serialise(invoiceDoc) as unknown as {
        _id: string;
        invoiceNumber: string;
        status: string;
      })
    : null;
  const money = { currency: settings.currency, locale: settings.locale };

  const isOpen = !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(
    reservation.reservationStatus,
  );

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/reservations">
          <ArrowLeft className="size-4" />
          All reservations
        </Link>
      </Button>

      <PageHeader
        title={reservation.reservationNumber}
        description={`Booked ${formatDateTime(reservation.createdAt, settings.locale)} via ${reservation.source}`}
        actions={
          <>
            <StatusBadge status={reservation.reservationStatus} />
            <StatusBadge status={reservation.paymentStatus} />
            <ReservationActions
              reservationId={reservation._id}
              reservationNumber={reservation.reservationNumber}
              reservationStatus={reservation.reservationStatus}
              balanceDue={reservation.balanceDue}
              invoiceId={invoice?._id}
              permissions={{
                cancel: can(user.role, "reservations:cancel"),
                checkIn: can(user.role, "checkin:manage"),
                checkOut: can(user.role, "checkout:manage"),
                takePayment: can(user.role, "payments:create"),
                refund: can(user.role, "payments:refund"),
              }}
            />
          </>
        }
      />

      {reservation.cancellationReason && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {label(reservation.reservationStatus)}
            {reservation.cancelledAt &&
              ` on ${formatDateTime(reservation.cancelledAt, settings.locale)}`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {reservation.cancellationReason}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="size-4" />
                Stay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                <Row
                  label="Check-in"
                  value={`${formatStayDate(reservation.checkInDate, settings.locale)} from ${settings.checkInTime}`}
                />
                <Row
                  label="Check-out"
                  value={`${formatStayDate(reservation.checkOutDate, settings.locale)} by ${settings.checkOutTime}`}
                />
                <Row
                  label="Nights"
                  value={`${reservation.numberOfNights} night(s)`}
                />
                <Row
                  label="Guests"
                  value={`${reservation.adults} adult(s)${reservation.children > 0 ? `, ${reservation.children} child(ren)` : ""}`}
                />
                <Row
                  label="Room"
                  value={
                    reservation.room ? (
                      <Link
                        href={`/rooms/${reservation.room._id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {reservation.room.roomNumber} (floor {reservation.room.floor})
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="Room type" value={reservation.roomType?.name ?? "—"} />
                <Row
                  label="Arrived"
                  value={formatDateTime(reservation.actualCheckInTime, settings.locale)}
                />
                <Row
                  label="Departed"
                  value={formatDateTime(reservation.actualCheckOutTime, settings.locale)}
                />
                <Row label="Booked by" value={reservation.createdBy?.name ?? "—"} />
                <Row
                  label="Checked in by"
                  value={reservation.checkedInBy?.name ?? "—"}
                />
                <Row
                  label="Checked out by"
                  value={reservation.checkedOutBy?.name ?? "—"}
                />
                <Row
                  label="Preferred payment"
                  value={label(reservation.preferredPaymentMethod)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" />
                Guest
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reservation.guest ? (
                <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                  <Row
                    label="Name"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/guests/${reservation.guest._id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {reservation.guest.firstName} {reservation.guest.lastName}
                        </Link>
                        {reservation.guest.isVip && <Badge variant="secondary">VIP</Badge>}
                      </span>
                    }
                  />
                  <Row label="Phone" value={reservation.guest.phone} />
                  <Row label="Email" value={reservation.guest.email ?? "—"} />
                  <Row label="Nationality" value={reservation.guest.nationality ?? "—"} />
                  <Row
                    label="ID recorded"
                    value={
                      reservation.idVerified ? (
                        <span className="inline-flex items-center gap-1.5">
                          <IdCard className="size-3.5" />
                          {label(reservation.idTypeRecorded)} ·{" "}
                          {reservation.idNumberRecorded ?? "—"}
                        </span>
                      ) : (
                        "Not yet verified"
                      )
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The guest profile for this reservation is no longer available.
                </p>
              )}
            </CardContent>
          </Card>

          {reservation.specialRequests && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <NotebookPen className="size-4" />
                  Special requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {reservation.specialRequests}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="gap-3 overflow-hidden pb-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4" />
                Payments
              </CardTitle>
              <CardDescription>
                Every movement on this folio, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {payments.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No payments recorded"
                  description="Take a payment from the actions menu above."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell>
                            <p className="font-medium">{payment.paymentId}</p>
                            {payment.transactionId && (
                              <p className="text-xs text-muted-foreground">
                                {payment.transactionId}
                              </p>
                            )}
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
        </div>

        <div className="space-y-4">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4" />
                Folio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FolioPanel
                reservationId={reservation._id}
                charges={reservation.additionalCharges}
                totals={{
                  numberOfNights: reservation.numberOfNights,
                  pricePerNight: reservation.pricePerNight,
                  roomCharges: reservation.roomCharges,
                  subtotal: reservation.subtotal,
                  discount: reservation.discount,
                  taxPercent: reservation.taxPercent,
                  tax: reservation.tax,
                  totalAmount: reservation.totalAmount,
                  amountPaid: reservation.amountPaid,
                  amountRefunded: reservation.amountRefunded,
                  balanceDue: reservation.balanceDue,
                }}
                currency={settings.currency}
                locale={settings.locale}
                editable={isOpen && can(user.role, "reservations:update")}
              />
            </CardContent>
          </Card>

          {invoice && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Invoice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                    <StatusBadge status={invoice.status} className="mt-1" />
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/invoices/${invoice._id}`}>Open</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{rowLabel}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
