"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatStayDate } from "@/lib/format";

export interface InvoiceRow {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  guestSnapshot: { name: string };
  staySnapshot: { roomNumber: string; checkInDate: string; checkOutDate: string };
  reservation?: { _id: string; reservationNumber: string } | null;
}

interface InvoicesTableProps {
  invoices: InvoiceRow[];
  meta: PaginationMeta;
  currency: string;
  locale: string;
}

export function InvoicesTable({ invoices, meta, currency, locale }: InvoicesTableProps) {
  const filters = useListFilters();
  const money = { currency, locale };
  const sort = filters.get("sort");
  const order = filters.get("order");

  return (
    <div className="space-y-3">
      <ListToolbar
        searchPlaceholder="Search invoice number or guest…"
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        filterValues={{ status: filters.get("status") }}
        onFilterChange={filters.setFilter}
        onReset={filters.reset}
        activeFilterCount={filters.activeFilterCount}
        isPending={filters.isPending}
        filters={[
          { key: "status", placeholder: "Any status", options: enumOptions(INVOICE_STATUSES) },
        ]}
      />

      <Card className="overflow-hidden p-0">
        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices match those filters"
            description="An invoice is generated automatically when a guest checks out."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      field="invoiceNumber"
                      currentSort={sort}
                      currentOrder={order}
                      onSort={filters.setSort}
                    >
                      Invoice
                    </SortableHeader>
                    <TableHead>Guest</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Stay</TableHead>
                    <SortableHeader
                      field="invoiceDate"
                      currentSort={sort}
                      currentOrder={order}
                      onSort={filters.setSort}
                    >
                      Issued
                    </SortableHeader>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${invoice._id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        {invoice.reservation && (
                          <p className="text-xs text-muted-foreground">
                            {invoice.reservation.reservationNumber}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{invoice.guestSnapshot.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.staySnapshot.roomNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatStayDate(invoice.staySnapshot.checkInDate, locale)} →{" "}
                        {formatStayDate(invoice.staySnapshot.checkOutDate, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatStayDate(invoice.invoiceDate, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(invoice.totalAmount, money)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {invoice.balanceDue > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatCurrency(invoice.balanceDue, money)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="invoices" />
          </>
        )}
      </Card>
    </div>
  );
}
