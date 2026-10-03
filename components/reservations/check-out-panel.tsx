"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarX,
  Check,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, label, type PaymentMethod } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatStayDate } from "@/lib/format";
import { calculateFolio, round2 } from "@/lib/pricing";
import { api, ApiClientError } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface DepartureRow {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  adults: number;
  children: number;
  pricePerNight: number;
  roomCharges: number;
  additionalCharges: { _id: string; description: string; amount: number; quantity: number }[];
  subtotal: number;
  taxPercent: number;
  tax: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  actualCheckInTime?: string | null;
  guest?: { _id: string; firstName: string; lastName: string; phone: string } | null;
  room?: { _id: string; roomNumber: string; floor: number } | null;
  roomType?: { name: string } | null;
}

interface CheckOutPanelProps {
  departures: DepartureRow[];
  currency: string;
  locale: string;
  checkOutTime: string;
}

interface ExtraCharge {
  key: string;
  description: string;
  amount: string;
  quantity: string;
}

/**
 * Departure flow: post any last charges, settle the balance, close the stay.
 *
 * The totals shown update live as charges and discounts are edited, using the
 * same `calculateFolio` the server applies — so the figure the guest is quoted
 * is the figure that gets billed.
 */
export function CheckOutPanel({
  departures,
  currency,
  locale,
  checkOutTime,
}: CheckOutPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("reservation");

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selectedId, setSelectedId] = React.useState<string | null>(preselected);

  const [extras, setExtras] = React.useState<ExtraCharge[]>([]);
  const [discount, setDiscount] = React.useState("0");
  const [settle, setSettle] = React.useState(true);
  const [method, setMethod] = React.useState<PaymentMethod>("CARD");
  const [transactionId, setTransactionId] = React.useState("");
  const [allowBalance, setAllowBalance] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return departures;
    return departures.filter((row) => {
      const name = row.guest
        ? `${row.guest.firstName} ${row.guest.lastName}`.toLowerCase()
        : "";
      return (
        row.reservationNumber.toLowerCase().includes(term) ||
        name.includes(term) ||
        (row.room?.roomNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [departures, debouncedSearch]);

  const selected = departures.find((row) => row._id === selectedId) ?? null;

  React.useEffect(() => {
    if (!selected) return;
    setExtras([]);
    setDiscount(String(selected.discount ?? 0));
    setSettle(true);
    setTransactionId("");
    setAllowBalance(false);
    setNotes("");
    setError(null);
  }, [selected]);

  /** Live recomputation of the bill with the desk's edits applied. */
  const projected = React.useMemo(() => {
    if (!selected) return null;

    const existing = selected.additionalCharges.map((charge) => ({
      amount: round2(charge.amount * (charge.quantity || 1)),
    }));
    const added = extras
      .map((extra) => ({
        amount: round2(Number(extra.amount || 0) * Number(extra.quantity || 1)),
      }))
      .filter((extra) => Number.isFinite(extra.amount) && extra.amount > 0);

    const folio = calculateFolio({
      checkInDate: selected.checkInDate,
      checkOutDate: selected.checkOutDate,
      pricePerNight: selected.pricePerNight,
      taxPercent: selected.taxPercent,
      discount: Number(discount || 0),
      additionalCharges: [...existing, ...added],
    });

    return {
      ...folio,
      balanceDue: round2(Math.max(0, folio.totalAmount - selected.amountPaid)),
    };
  }, [selected, extras, discount]);

  const settlementAmount = projected?.balanceDue ?? 0;

  function addExtra() {
    setExtras((prev) => [
      ...prev,
      { key: crypto.randomUUID(), description: "", amount: "", quantity: "1" },
    ]);
  }

  function updateExtra(key: string, patch: Partial<ExtraCharge>) {
    setExtras((prev) =>
      prev.map((extra) => (extra.key === key ? { ...extra, ...patch } : extra)),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !projected) return;

    const additionalCharges = extras
      .filter((extra) => extra.description.trim() && Number(extra.amount) > 0)
      .map((extra) => ({
        description: extra.description.trim(),
        amount: Number(extra.amount),
        quantity: Number(extra.quantity || 1),
      }));

    if (extras.length > 0 && additionalCharges.length !== extras.length) {
      setError("Give every added charge a description and an amount above zero.");
      return;
    }
    if (!settle && projected.balanceDue > 0 && !allowBalance) {
      setError(
        "There is still a balance. Take payment, or tick the box to close the stay with money outstanding.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, message } = await api.post<{
        reservationId: string;
        invoiceId: string;
      }>("/api/check-out", {
        reservation: selected._id,
        additionalCharges,
        discount: Number(discount || 0),
        allowOutstandingBalance: allowBalance,
        notes: notes || undefined,
        ...(settle && settlementAmount > 0
          ? {
              settlement: {
                amount: settlementAmount,
                method,
                transactionId: transactionId || undefined,
              },
            }
          : {}),
      });

      toast.success(message);
      router.push(`/invoices/${data.invoiceId}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Could not complete the check-out.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const money = { currency, locale };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="gap-3 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">In-house guests</CardTitle>
          <CardDescription>Anyone currently checked in can be checked out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search number, guest or room…"
              className="pl-8"
              aria-label="Search departures"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title={departures.length === 0 ? "Nobody in house" : "Nothing matches"}
              description={
                departures.length === 0
                  ? "Checked-in guests appear here."
                  : "Try a different search term."
              }
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => {
                const active = row._id === selectedId;
                const dueToday =
                  new Date(row.checkOutDate).toISOString().slice(0, 10) <=
                  new Date().toISOString().slice(0, 10);
                return (
                  <li key={row._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row._id)}
                      aria-pressed={active}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {row.guest
                            ? `${row.guest.firstName} ${row.guest.lastName}`
                            : "Unknown guest"}
                          {active && <Check className="size-4 text-primary" />}
                        </span>
                        <StatusBadge status={row.paymentStatus} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Room {row.room?.roomNumber ?? "—"} · {row.reservationNumber}
                        {dueToday && (
                          <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                            · due today
                          </span>
                        )}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Check out</CardTitle>
          <CardDescription>
            Post any final charges, settle the balance and close the folio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selected || !projected ? (
            <EmptyState
              icon={CalendarX}
              title="Select a guest"
              description="Choose an in-house reservation from the list."
            />
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                <Row label="Reservation" value={selected.reservationNumber} />
                <Row
                  label="Guest"
                  value={
                    selected.guest ? (
                      <Link
                        href={`/guests/${selected.guest._id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {selected.guest.firstName} {selected.guest.lastName}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label="Room"
                  value={`${selected.room?.roomNumber ?? "—"} · ${selected.roomType?.name ?? ""}`}
                />
                <Row
                  label="Stay"
                  value={`${formatStayDate(selected.checkInDate, locale)} → ${formatStayDate(selected.checkOutDate, locale)} (${projected.numberOfNights}n)`}
                />
                <Row
                  label="Arrived"
                  value={formatDateTime(selected.actualCheckInTime, locale)}
                />
                <Row label="Already paid" value={formatCurrency(selected.amountPaid, money)} />
              </dl>

              <section className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Additional charges</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addExtra}>
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>

                {selected.additionalCharges.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {selected.additionalCharges.map((charge) => (
                      <li key={charge._id} className="flex justify-between text-muted-foreground">
                        <span>
                          {charge.description}
                          {charge.quantity > 1 && ` × ${charge.quantity}`}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(charge.amount * charge.quantity, money)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {extras.map((extra) => (
                  <div key={extra.key} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1 space-y-1">
                      <Label htmlFor={`extra-${extra.key}`} className="text-xs">
                        Description
                      </Label>
                      <Input
                        id={`extra-${extra.key}`}
                        value={extra.description}
                        placeholder="Minibar"
                        onChange={(event) =>
                          updateExtra(extra.key, { description: event.target.value })
                        }
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label htmlFor={`amount-${extra.key}`} className="text-xs">
                        Amount
                      </Label>
                      <Input
                        id={`amount-${extra.key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={extra.amount}
                        onChange={(event) =>
                          updateExtra(extra.key, { amount: event.target.value })
                        }
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label htmlFor={`qty-${extra.key}`} className="text-xs">
                        Qty
                      </Label>
                      <Input
                        id={`qty-${extra.key}`}
                        type="number"
                        min={1}
                        value={extra.quantity}
                        onChange={(event) =>
                          updateExtra(extra.key, { quantity: event.target.value })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove charge"
                      onClick={() =>
                        setExtras((prev) => prev.filter((item) => item.key !== extra.key))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </section>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="checkOutDiscount" className="text-xs">
                    Discount
                  </Label>
                  <Input
                    id="checkOutDiscount"
                    type="number"
                    min={0}
                    step="0.01"
                    className="max-w-40"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                </div>

                <Separator className="my-3" />

                <dl className="space-y-2 text-sm">
                  <Row
                    label={`Room charges (${projected.numberOfNights}n)`}
                    value={formatCurrency(projected.roomCharges, money)}
                  />
                  <Row
                    label="Additional charges"
                    value={formatCurrency(projected.additionalCharges, money)}
                  />
                  <Row label="Subtotal" value={formatCurrency(projected.subtotal, money)} />
                  {projected.discount > 0 && (
                    <Row
                      label="Discount"
                      value={`− ${formatCurrency(projected.discount, money)}`}
                    />
                  )}
                  <Row
                    label={`Tax (${selected.taxPercent}%)`}
                    value={formatCurrency(projected.tax, money)}
                  />
                  <Separator className="my-2" />
                  <Row label="Total" value={formatCurrency(projected.totalAmount, money)} />
                  <Row label="Paid" value={formatCurrency(selected.amountPaid, money)} />
                </dl>

                <div className="mt-2 flex items-baseline justify-between border-t pt-2">
                  <span className="font-semibold">Outstanding</span>
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      projected.balanceDue > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatCurrency(projected.balanceDue, money)}
                  </span>
                </div>
              </div>

              {projected.balanceDue > 0 && (
                <section className="space-y-3">
                  <label className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
                    <Checkbox
                      checked={settle}
                      onCheckedChange={(checked) => setSettle(checked === true)}
                    />
                    <span className="text-sm">
                      Take {formatCurrency(projected.balanceDue, money)} now
                    </span>
                  </label>

                  {settle ? (
                    <>
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Method</legend>
                        <RadioGroup
                          value={method}
                          onValueChange={(value) => setMethod(value as PaymentMethod)}
                          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        >
                          {PAYMENT_METHODS.map((item) => (
                            <label
                              key={item}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/50"
                            >
                              <RadioGroupItem value={item} />
                              {label(item)}
                            </label>
                          ))}
                        </RadioGroup>
                      </fieldset>
                      <div className="space-y-1.5">
                        <Label htmlFor="checkOutTxn">Transaction reference</Label>
                        <Input
                          id="checkOutTxn"
                          value={transactionId}
                          onChange={(event) => setTransactionId(event.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <label className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
                      <Checkbox
                        checked={allowBalance}
                        onCheckedChange={(checked) => setAllowBalance(checked === true)}
                      />
                      <span className="text-sm">
                        Close the stay with a balance outstanding
                        <span className="block text-xs text-muted-foreground">
                          For corporate billing or a disputed charge. The invoice shows the
                          amount still due.
                        </span>
                      </span>
                    </label>
                  )}
                </section>
              )}

              {projected.balanceDue === 0 && (
                <Alert>
                  <Check className="size-4" />
                  <AlertDescription>
                    The folio is settled. Checking out will issue the invoice.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="checkOutNotes">Invoice notes</Label>
                <Textarea
                  id="checkOutNotes"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Printed on the invoice."
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FieldError message={undefined} />

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Check-out by {checkOutTime}. The room goes to cleaning and an invoice is
                  generated.
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <CalendarX className="size-4" />
                  )}
                  {saving ? "Checking out…" : "Complete check-out"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{rowLabel}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
