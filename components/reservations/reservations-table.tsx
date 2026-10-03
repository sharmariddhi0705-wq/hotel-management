"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Ellipsis, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar, enumOptions } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { SortableHeader } from "@/components/shared/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CancelReservationDialog } from "@/components/reservations/cancel-dialog";
import { useListFilters } from "@/hooks/use-list-filters";
import { PAYMENT_STATUSES, RESERVATION_STATUSES } from "@/lib/constants";
import { formatCurrency, formatStayDate } from "@/lib/format";

export interface ReservationRow {
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
  guest?: { _id: string; firstName: string; lastName: string; phone: string; isVip?: boolean } | null;
  room?: { roomNumber: string } | null;
  roomType?: { name: string } | null;
}

interface ReservationsTableProps {
  reservations: ReservationRow[];
  meta: PaginationMeta;
  currency: string;
  locale: string;
  permissions: { create: boolean; cancel: boolean };
}

const VIEWS = [
  { value: "all", label: "All" },
  { value: "arrivals", label: "Arrivals today" },
  { value: "departures", label: "Departures today" },
  { value: "inhouse", label: "In house" },
];

export function ReservationsTable({
  reservations,
  meta,
  currency,
  locale,
  permissions,
}: ReservationsTableProps) {
  const router = useRouter();
  const filters = useListFilters();
  const [cancelling, setCancelling] = React.useState<ReservationRow | undefined>();

  const sort = filters.get("sort");
  const order = filters.get("order");
  const view = filters.get("view") ?? "all";
  const money = { currency, locale };

  return (
    <>
      <div className="space-y-3">
        <Tabs value={view} onValueChange={(value) => filters.setFilter("view", value)}>
          <TabsList>
            {VIEWS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ListToolbar
          searchPlaceholder="Search number, guest or room…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{
            reservationStatus: filters.get("reservationStatus"),
            paymentStatus: filters.get("paymentStatus"),
          }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            {
              key: "reservationStatus",
              placeholder: "Any status",
              options: enumOptions(RESERVATION_STATUSES),
            },
            {
              key: "paymentStatus",
              placeholder: "Any payment state",
              options: enumOptions(PAYMENT_STATUSES),
            },
          ]}
        >
          {permissions.create && (
            <Button size="sm" asChild>
              <Link href="/reservations/new">
                <Plus className="size-4" />
                New reservation
              </Link>
            </Button>
          )}
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {reservations.length === 0 ? (
            <EmptyState
              icon={BookOpenCheck}
              title="No reservations match this view"
              description={
                view !== "all"
                  ? "Nothing is scheduled for this view today."
                  : "Take a booking to get started."
              }
              action={
                permissions.create ? (
                  <Button size="sm" asChild>
                    <Link href="/reservations/new">
                      <Plus className="size-4" />
                      New reservation
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader
                        field="reservationNumber"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Reservation
                      </SortableHeader>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <SortableHeader
                        field="checkInDate"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Stay
                      </SortableHeader>
                      <TableHead className="text-right">Guests</TableHead>
                      <SortableHeader
                        field="totalAmount"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                        className="text-right"
                      >
                        Total
                      </SortableHeader>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => (
                      <TableRow key={reservation._id}>
                        <TableCell>
                          <Link
                            href={`/reservations/${reservation._id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {reservation.reservationNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {reservation.guest ? (
                            <>
                              <Link
                                href={`/guests/${reservation.guest._id}`}
                                className="text-sm underline-offset-4 hover:underline"
                              >
                                {reservation.guest.firstName} {reservation.guest.lastName}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {reservation.guest.phone}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {reservation.room?.roomNumber ?? "—"}
                          {reservation.roomType?.name && (
                            <span className="block text-xs">{reservation.roomType.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatStayDate(reservation.checkInDate, locale)}
                          <span className="block text-xs">
                            → {formatStayDate(reservation.checkOutDate, locale)} ·{" "}
                            {reservation.numberOfNights}n
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {reservation.adults}
                          {reservation.children > 0 ? `+${reservation.children}` : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(reservation.totalAmount, money)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {reservation.balanceDue > 0 ? (
                            <Badge variant="destructive">
                              {formatCurrency(reservation.balanceDue, money)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={reservation.reservationStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={reservation.paymentStatus} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${reservation.reservationNumber}`}
                              >
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/reservations/${reservation._id}`}>
                                  View details
                                </Link>
                              </DropdownMenuItem>
                              {["PENDING", "CONFIRMED"].includes(
                                reservation.reservationStatus,
                              ) && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/check-in?reservation=${reservation._id}`}>
                                    Check in
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {reservation.reservationStatus === "CHECKED_IN" && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/check-out?reservation=${reservation._id}`}>
                                    Check out
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {permissions.cancel &&
                                ["PENDING", "CONFIRMED"].includes(
                                  reservation.reservationStatus,
                                ) && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setCancelling(reservation)}
                                  >
                                    <XCircle className="size-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataPagination
                meta={meta}
                onPageChange={filters.setPage}
                itemLabel="reservations"
              />
            </>
          )}
        </Card>
      </div>

      {cancelling && (
        <CancelReservationDialog
          open
          onOpenChange={(open) => !open && setCancelling(undefined)}
          reservationId={cancelling._id}
          reservationNumber={cancelling.reservationNumber}
          onCancelled={() => {
            setCancelling(undefined);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
