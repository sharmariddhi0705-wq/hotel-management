"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarX,
  Ellipsis,
  FileText,
  RotateCcw,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CancelReservationDialog } from "@/components/reservations/cancel-dialog";
import { PaymentDialog } from "@/components/payments/payment-dialog";

interface ReservationActionsProps {
  reservationId: string;
  reservationNumber: string;
  reservationStatus: string;
  balanceDue: number;
  invoiceId?: string;
  permissions: {
    cancel: boolean;
    checkIn: boolean;
    checkOut: boolean;
    takePayment: boolean;
    refund: boolean;
  };
}

/**
 * Context actions on a reservation. Which ones appear depends on where the stay
 * is in its lifecycle — a checked-out booking cannot be checked in again, and a
 * cancelled one cannot take a payment.
 */
export function ReservationActions({
  reservationId,
  reservationNumber,
  reservationStatus,
  balanceDue,
  invoiceId,
  permissions,
}: ReservationActionsProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [paymentKind, setPaymentKind] = React.useState<"PAYMENT" | "REFUND">("PAYMENT");

  const canCheckIn =
    permissions.checkIn && ["PENDING", "CONFIRMED"].includes(reservationStatus);
  const canCheckOut = permissions.checkOut && reservationStatus === "CHECKED_IN";
  const isClosed = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservationStatus);

  function openPayment(kind: "PAYMENT" | "REFUND") {
    setPaymentKind(kind);
    setPaymentOpen(true);
  }

  return (
    <>
      {canCheckIn && (
        <Button size="sm" asChild>
          <Link href={`/check-in?reservation=${reservationId}`}>
            <CalendarCheck className="size-4" />
            Check in
          </Link>
        </Button>
      )}
      {canCheckOut && (
        <Button size="sm" asChild>
          <Link href={`/check-out?reservation=${reservationId}`}>
            <CalendarX className="size-4" />
            Check out
          </Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More actions">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {permissions.takePayment && !isClosed && balanceDue > 0 && (
            <DropdownMenuItem onClick={() => openPayment("PAYMENT")}>
              <Wallet className="size-4" />
              Take a payment
            </DropdownMenuItem>
          )}
          {permissions.refund && (
            <DropdownMenuItem onClick={() => openPayment("REFUND")}>
              <RotateCcw className="size-4" />
              Record a refund
            </DropdownMenuItem>
          )}
          {invoiceId && (
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoiceId}`}>
                <FileText className="size-4" />
                View invoice
              </Link>
            </DropdownMenuItem>
          )}

          {permissions.cancel && ["PENDING", "CONFIRMED"].includes(reservationStatus) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="size-4" />
                Cancel reservation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CancelReservationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        reservationId={reservationId}
        reservationNumber={reservationNumber}
        onCancelled={() => {
          setCancelOpen(false);
          router.refresh();
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        reservationId={reservationId}
        reservationNumber={reservationNumber}
        balanceDue={balanceDue}
        kind={paymentKind}
      />
    </>
  );
}
