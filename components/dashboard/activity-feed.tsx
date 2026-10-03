import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatRelative, formatStayDate } from "@/lib/format";
import { label } from "@/lib/constants";
import type {
  RecentMovement,
  RecentPayment,
  RecentReservation,
} from "@/lib/dashboard";

interface FeedShellProps {
  title: string;
  description: string;
  href?: string;
  children: React.ReactNode;
}

function FeedShell({ title, description, href, children }: FeedShellProps) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {href && (
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href={href}>
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function guestName(entry: { guest?: { firstName: string; lastName: string } | null }) {
  return entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}` : "Unknown guest";
}

export function RecentReservationsCard({
  reservations,
  currency,
  locale,
}: {
  reservations: RecentReservation[];
  currency: string;
  locale: string;
}) {
  return (
    <FeedShell
      title="Recent reservations"
      description="The latest bookings taken at this property."
      href="/reservations"
    >
      {reservations.length === 0 ? (
        <EmptyState title="No reservations yet" description="New bookings appear here." />
      ) : (
        <ul className="divide-y">
          {reservations.map((reservation) => (
            <li key={reservation._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/reservations/${reservation._id}`}
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {guestName(reservation)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {reservation.reservationNumber} · Room{" "}
                  {reservation.room?.roomNumber ?? "—"} ·{" "}
                  {formatStayDate(reservation.checkInDate, locale)} →{" "}
                  {formatStayDate(reservation.checkOutDate, locale)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">
                  {formatCurrency(reservation.totalAmount, { currency, locale })}
                </p>
                <StatusBadge status={reservation.reservationStatus} className="mt-0.5" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </FeedShell>
  );
}

export function RecentMovementsCard({
  title,
  description,
  movements,
  kind,
}: {
  title: string;
  description: string;
  movements: RecentMovement[];
  kind: "in" | "out";
}) {
  return (
    <FeedShell title={title} description={description}>
      {movements.length === 0 ? (
        <EmptyState
          title={kind === "in" ? "No arrivals recorded" : "No departures recorded"}
          description="Front-desk activity appears here."
        />
      ) : (
        <ul className="divide-y">
          {movements.map((movement) => (
            <li key={movement._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{guestName(movement)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {movement.reservationNumber} · Room {movement.room?.roomNumber ?? "—"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(
                  kind === "in" ? movement.actualCheckInTime : movement.actualCheckOutTime,
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FeedShell>
  );
}

export function RecentPaymentsCard({
  payments,
  currency,
  locale,
}: {
  payments: RecentPayment[];
  currency: string;
  locale: string;
}) {
  return (
    <FeedShell
      title="Recent payments"
      description="Money received and refunded."
      href="/payments"
    >
      {payments.length === 0 ? (
        <EmptyState title="No payments yet" description="Settlements appear here." />
      ) : (
        <ul className="divide-y">
          {payments.map((payment) => (
            <li key={payment._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{guestName(payment)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {payment.paymentId} · {label(payment.method)}
                  {payment.reservation ? ` · ${payment.reservation.reservationNumber}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={
                    payment.kind === "REFUND"
                      ? "text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400"
                      : "text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {payment.kind === "REFUND" ? "−" : "+"}
                  {formatCurrency(payment.amount, { currency, locale })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelative(payment.paymentDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FeedShell>
  );
}
