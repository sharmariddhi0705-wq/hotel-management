"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Check, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { cn } from "@/lib/utils";
import { ID_TYPES, label } from "@/lib/constants";
import { formatCurrency, formatStayDate } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ArrivalRow {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  adults: number;
  children: number;
  totalAmount: number;
  balanceDue: number;
  reservationStatus: string;
  paymentStatus: string;
  specialRequests?: string;
  guest?: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    idType?: string;
    idNumber?: string;
    isVip?: boolean;
  } | null;
  room?: {
    _id: string;
    roomNumber: string;
    floor: number;
    status: string;
    housekeepingStatus: string;
  } | null;
  roomType?: { name: string } | null;
}

interface CheckInPanelProps {
  arrivals: ArrivalRow[];
  currency: string;
  locale: string;
  checkInTime: string;
}

/**
 * Front-desk arrival flow: find the reservation, verify the guest, record their
 * identification, confirm. Room readiness is checked server-side — a dirty or
 * occupied room is refused there, not merely discouraged here.
 */
export function CheckInPanel({
  arrivals,
  currency,
  locale,
  checkInTime,
}: CheckInPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("reservation");

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selectedId, setSelectedId] = React.useState<string | null>(preselected);

  const [idType, setIdType] = React.useState<string>("PASSPORT");
  const [idNumber, setIdNumber] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return arrivals;
    return arrivals.filter((arrival) => {
      const guestName = arrival.guest
        ? `${arrival.guest.firstName} ${arrival.guest.lastName}`.toLowerCase()
        : "";
      return (
        arrival.reservationNumber.toLowerCase().includes(term) ||
        guestName.includes(term) ||
        (arrival.guest?.phone ?? "").toLowerCase().includes(term) ||
        (arrival.room?.roomNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [arrivals, debouncedSearch]);

  const selected = arrivals.find((arrival) => arrival._id === selectedId) ?? null;

  // Pre-fill identification from the guest profile when one is selected.
  React.useEffect(() => {
    if (!selected?.guest) return;
    setIdType(selected.guest.idType ?? "PASSPORT");
    setIdNumber(selected.guest.idNumber ?? "");
    setVerified(false);
    setNotes("");
    setError(null);
  }, [selected]);

  const roomReady =
    selected?.room &&
    !["DIRTY", "IN_PROGRESS", "MAINTENANCE_REQUIRED"].includes(
      selected.room.housekeepingStatus,
    ) &&
    !["OCCUPIED", "MAINTENANCE", "OUT_OF_SERVICE"].includes(selected.room.status);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;

    if (!verified) {
      setError("Confirm that you have seen the guest's identification.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, message } = await api.post<{ reservationId: string }>("/api/check-in", {
        reservation: selected._id,
        idType,
        idNumber,
        idVerified: true,
        notes: notes || undefined,
      });
      toast.success(message);
      router.push(`/reservations/${data.reservationId}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Could not complete the check-in.";
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
          <CardTitle className="text-base">Expected arrivals</CardTitle>
          <CardDescription>
            Reservations due to arrive today or already overdue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search number, guest, phone or room…"
              className="pl-8"
              aria-label="Search arrivals"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={arrivals.length === 0 ? "No arrivals due" : "Nothing matches"}
              description={
                arrivals.length === 0
                  ? "Confirmed reservations arriving today will appear here."
                  : "Try a different search term."
              }
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((arrival) => {
                const active = arrival._id === selectedId;
                return (
                  <li key={arrival._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(arrival._id)}
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
                          {arrival.guest
                            ? `${arrival.guest.firstName} ${arrival.guest.lastName}`
                            : "Unknown guest"}
                          {arrival.guest?.isVip && <Badge variant="secondary">VIP</Badge>}
                          {active && <Check className="size-4 text-primary" />}
                        </span>
                        <StatusBadge status={arrival.reservationStatus} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {arrival.reservationNumber} · Room {arrival.room?.roomNumber ?? "—"} ·{" "}
                        {arrival.numberOfNights} night(s)
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
          <CardTitle className="text-base">Check in</CardTitle>
          <CardDescription>
            Verify the guest and record their identification before confirming.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <EmptyState
              icon={CalendarCheck}
              title="Select an arrival"
              description="Choose a reservation from the list to begin."
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
                <Row label="Phone" value={selected.guest?.phone ?? "—"} />
                <Row
                  label="Room"
                  value={`${selected.room?.roomNumber ?? "—"} · ${selected.roomType?.name ?? ""}`}
                />
                <Row
                  label="Stay"
                  value={`${formatStayDate(selected.checkInDate, locale)} → ${formatStayDate(selected.checkOutDate, locale)}`}
                />
                <Row
                  label="Guests"
                  value={`${selected.adults} adult(s)${selected.children > 0 ? `, ${selected.children} child(ren)` : ""}`}
                />
                <Row label="Total" value={formatCurrency(selected.totalAmount, money)} />
                <Row
                  label="Balance"
                  value={
                    selected.balanceDue > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatCurrency(selected.balanceDue, money)}
                      </span>
                    ) : (
                      "Settled"
                    )
                  }
                />
              </dl>

              {selected.specialRequests && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Special requests
                  </p>
                  <p className="mt-0.5 text-sm">{selected.specialRequests}</p>
                </div>
              )}

              {selected.room && !roomReady && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertDescription>
                    Room {selected.room.roomNumber} is{" "}
                    {label(selected.room.housekeepingStatus).toLowerCase()} and{" "}
                    {label(selected.room.status).toLowerCase()}. Have housekeeping
                    release it, or move the guest to another room before checking in.
                  </AlertDescription>
                </Alert>
              )}

              <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <legend className="sr-only">Identification</legend>
                <div className="space-y-1.5">
                  <Label htmlFor="checkInIdType">ID type</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger id="checkInIdType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {label(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkInIdNumber">ID number</Label>
                  <Input
                    id="checkInIdNumber"
                    value={idNumber}
                    onChange={(event) => setIdNumber(event.target.value)}
                    placeholder="As shown on the document"
                  />
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="checkInNotes">Arrival notes</Label>
                <Textarea
                  id="checkInNotes"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Late arrival, luggage stored at the desk."
                />
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
                <Checkbox
                  checked={verified}
                  onCheckedChange={(checked) => setVerified(checked === true)}
                />
                <span className="text-sm">
                  I have seen the guest&apos;s identification and it matches the booking.
                  <span className="block text-xs text-muted-foreground">
                    Required before the check-in can be confirmed.
                  </span>
                </span>
              </label>

              <FieldError message={error ?? undefined} />

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Check-in from {checkInTime}. The room is marked occupied on confirmation.
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="size-4" />
                  )}
                  {saving ? "Checking in…" : "Confirm check-in"}
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
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
