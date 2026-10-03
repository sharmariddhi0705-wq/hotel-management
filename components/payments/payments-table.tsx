"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar, enumOptions } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { SortableHeader } from "@/components/shared/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useListFilters } from "@/hooks/use-list-filters";
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
  label,
} from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";

export interface PaymentRow {
  _id: string;
  paymentId: string;
  kind: string;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
  transactionId?: string;
  notes?: string;
  guest?: { _id: string; firstName: string; lastName: string; phone: string } | null;
  reservation?: { _id: string; reservationNumber: string; balanceDue: number } | null;
  receivedBy?: { name: string } | null;
}

interface PaymentsTableProps {
  payments: PaymentRow[];
  meta: PaginationMeta;
  currency: string;
  locale: string;
}

export function PaymentsTable({ payments, meta, currency, locale }: PaymentsTableProps) {
  const filters = useListFilters();
  const money = { currency, locale };
  const sort = filters.get("sort");
  const order = filters.get("order");

  return (
    <div className="space-y-3">
      <ListToolbar
        searchPlaceholder="Search reference or transaction id…"
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        filterValues={{
          method: filters.get("method"),
          status: filters.get("status"),
          kind: filters.get("kind"),
        }}
        onFilterChange={filters.setFilter}
        onReset={filters.reset}
        activeFilterCount={filters.activeFilterCount}
        isPending={filters.isPending}
        filters={[
          { key: "method", placeholder: "Any method", options: enumOptions(PAYMENT_METHODS) },
          {
            key: "status",
            placeholder: "Any status",
            options: enumOptions(PAYMENT_RECORD_STATUSES),
          },
          { key: "kind", placeholder: "Payments & refunds", options: enumOptions(PAYMENT_KINDS) },
        ]}
      />

      <Card className="overflow-hidden p-0">
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments match those filters"
            description="Payments are recorded from a reservation or at check-out."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Reservation</TableHead>
                    <SortableHeader
                      field="paymentDate"
                      currentSort={sort}
                      currentOrder={order}
                      onSort={filters.setSort}
                    >
                      Date
                    </SortableHeader>
                    <TableHead>Method</TableHead>
                    <SortableHeader
                      field="amount"
                      currentSort={sort}
                      currentOrder={order}
                      onSort={filters.setSort}
                      className="text-right"
                    >
                      Amount
                    </SortableHeader>
                    <TableHead>Status</TableHead>
                    <TableHead>Taken by</TableHead>
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
                      <TableCell>
                        {payment.guest ? (
                          <Link
                            href={`/guests/${payment.guest._id}`}
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            {payment.guest.firstName} {payment.guest.lastName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.reservation ? (
                          <Link
                            href={`/reservations/${payment.reservation._id}`}
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            {payment.reservation.reservationNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(payment.paymentDate, locale)}
                      </TableCell>
                      <TableCell>{label(payment.method)}</TableCell>
                      <TableCell
                        className={
                          payment.kind === "REFUND"
                            ? "text-right font-medium tabular-nums text-rose-600 dark:text-rose-400"
                            : "text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {payment.kind === "REFUND" ? "−" : "+"}
                        {formatCurrency(payment.amount, money)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.receivedBy?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="payments" />
          </>
        )}
      </Card>
    </div>
  );
}

/** Summary tiles above the payments table. */
export function PaymentsSummary({
  summary,
  currency,
  locale,
}: {
  summary: { collected: number; refunded: number; net: number };
  currency: string;
  locale: string;
}) {
  const money = { currency, locale };
  const tiles = [
    { label: "Collected", value: summary.collected, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Refunded", value: summary.refunded, tone: "text-rose-600 dark:text-rose-400" },
    { label: "Net", value: summary.net, tone: "" },
  ];

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-xs font-medium text-muted-foreground">
              {tile.label} (current filters)
            </p>
            <p className={`mt-1.5 text-xl font-semibold tabular-nums ${tile.tone}`}>
              {formatCurrency(tile.value, money)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
