"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatStayDate } from "@/lib/format";
import type { FolioTotals } from "@/lib/pricing";
import type { StayDraft } from "@/components/reservations/step-dates";
import type { AvailableRoom } from "@/components/reservations/step-room";
import type { GuestChoice } from "@/components/reservations/step-guest";

interface StepSummaryProps {
  stay: StayDraft;
  room: AvailableRoom;
  guest: GuestChoice;
  folio: FolioTotals;
  pricePerNight: number;
  discount: number;
  taxPercent: number;
  currency: string;
  locale: string;
  checkInTime: string;
  checkOutTime: string;
  onRateChange: (rate: number | null) => void;
  onDiscountChange: (discount: number) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Step 4: the booking summary, with the negotiated rate and discount editable.
 *
 * The figures shown here are computed by the same `calculateFolio` the server
 * uses, so the quote the guest is given matches the folio that gets written.
 */
export function StepSummary({
  stay,
  room,
  guest,
  folio,
  pricePerNight,
  discount,
  taxPercent,
  currency,
  locale,
  checkInTime,
  checkOutTime,
  onRateChange,
  onDiscountChange,
  onBack,
  onNext,
}: StepSummaryProps) {
  const money = { currency, locale };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Booking summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the details, then adjust the rate or apply a discount if agreed.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stay
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              <Row label="Room" value={`${room.roomNumber}`} />
              <Row label="Room type" value={room.roomType?.name ?? "Unclassified"} />
              <Row
                label="Check-in"
                value={`${formatStayDate(stay.checkInDate, locale)} from ${checkInTime}`}
              />
              <Row
                label="Check-out"
                value={`${formatStayDate(stay.checkOutDate, locale)} by ${checkOutTime}`}
              />
              <Row
                label="Nights"
                value={`${folio.numberOfNights} night${folio.numberOfNights === 1 ? "" : "s"}`}
              />
              <Row
                label="Guests"
                value={`${stay.adults} adult(s)${stay.children > 0 ? `, ${stay.children} child(ren)` : ""}`}
              />
              <Row label="Source" value={stay.source} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Guest
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              <Row label="Name" value={guest.display} />
              <Row label="Phone" value={guest.phone} />
              <Row
                label="Profile"
                value={guest.kind === "existing" ? "Existing guest" : "New — will be created"}
              />
            </dl>
          </section>

          {stay.specialRequests && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Special requests
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{stay.specialRequests}</p>
            </section>
          )}
        </div>

        <div className="rounded-xl border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Charges</h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rateOverride" className="text-xs">
                Rate per night
              </Label>
              <Input
                id="rateOverride"
                type="number"
                min={0}
                step="0.01"
                value={pricePerNight}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  onRateChange(Number.isFinite(value) ? value : null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discountInput" className="text-xs">
                Discount
              </Label>
              <Input
                id="discountInput"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  onDiscountChange(Number.isFinite(value) && value > 0 ? value : 0);
                }}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <dl className="space-y-2 text-sm">
            <Row
              label={`Room ${room.roomNumber} × ${folio.numberOfNights} night(s)`}
              value={formatCurrency(folio.roomCharges, money)}
            />
            <Row label="Subtotal" value={formatCurrency(folio.subtotal, money)} />
            {folio.discount > 0 && (
              <Row
                label="Discount"
                value={`− ${formatCurrency(folio.discount, money)}`}
                tone="positive"
              />
            )}
            <Row
              label={`Tax (${taxPercent}%)`}
              value={formatCurrency(folio.tax, money)}
            />
          </dl>

          <Separator className="my-4" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatCurrency(folio.totalAmount, money)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tax is charged on the amount after the discount.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Continue to payment
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "positive";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "positive"
            ? "text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
            : "text-right font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
