"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime, formatStayDate } from "@/lib/format";
import { label } from "@/lib/constants";

export interface InvoiceDocument {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  hotelSnapshot: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    currency: string;
    currencySymbol: string;
  };
  guestSnapshot: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    idType?: string;
    idNumber?: string;
    nationality?: string;
  };
  staySnapshot: {
    roomNumber: string;
    roomTypeName: string;
    checkInDate: string;
    checkOutDate: string;
    actualCheckInTime?: string | null;
    actualCheckOutTime?: string | null;
    numberOfNights: number;
    adults: number;
    children: number;
  };
  lines: { description: string; quantity: number; unitPrice: number; amount: number }[];
  roomCharges: number;
  additionalCharges: number;
  subtotal: number;
  discount: number;
  taxPercent: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethods: string[];
  notes?: string;
}

interface InvoicePayment {
  _id: string;
  paymentId: string;
  kind: string;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
}

interface InvoiceSheetProps {
  invoice: InvoiceDocument;
  payments: InvoicePayment[];
  locale: string;
  invoiceFooter?: string;
}

/**
 * Printable invoice.
 *
 * Every value comes from the snapshots frozen when the invoice was issued, so a
 * reprint months later shows exactly what the guest was given. Printing uses the
 * browser's own dialogue (which offers "Save as PDF"), keeping the output
 * identical to what is on screen without a PDF library.
 */
export function InvoiceSheet({
  invoice,
  payments,
  locale,
  invoiceFooter,
}: InvoiceSheetProps) {
  const money = {
    currency: invoice.hotelSnapshot.currency,
    locale,
    symbol: invoice.hotelSnapshot.currencySymbol,
  };

  const handlePrint = React.useCallback(() => window.print(), []);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handlePrint}>
          <Printer className="size-4" />
          Print
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Download className="size-4" />
          Save as PDF
        </Button>
        <span className="text-xs text-muted-foreground">
          Choose “Save as PDF” as the destination in the print dialogue.
        </span>
      </div>

      <article className="print-sheet mx-auto max-w-3xl rounded-xl border bg-card p-6 sm:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{invoice.hotelSnapshot.name}</h2>
            {invoice.hotelSnapshot.address && (
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {invoice.hotelSnapshot.address}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {[invoice.hotelSnapshot.phone, invoice.hotelSnapshot.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {invoice.hotelSnapshot.taxId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Tax ID: {invoice.hotelSnapshot.taxId}
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tax invoice
            </p>
            <p className="mt-0.5 text-lg font-semibold">{invoice.invoiceNumber}</p>
            <p className="text-sm text-muted-foreground">
              {formatStayDate(invoice.invoiceDate, locale)}
            </p>
            <div className="mt-2 sm:flex sm:justify-end">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </header>

        <Separator className="my-6" />

        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Billed to
            </h3>
            <p className="mt-2 font-medium">{invoice.guestSnapshot.name}</p>
            {invoice.guestSnapshot.address && (
              <p className="text-sm text-muted-foreground">{invoice.guestSnapshot.address}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {[invoice.guestSnapshot.phone, invoice.guestSnapshot.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {invoice.guestSnapshot.idNumber && (
              <p className="mt-1 text-xs text-muted-foreground">
                {label(invoice.guestSnapshot.idType)}: {invoice.guestSnapshot.idNumber}
              </p>
            )}
            {invoice.guestSnapshot.nationality && (
              <p className="text-xs text-muted-foreground">
                Nationality: {invoice.guestSnapshot.nationality}
              </p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stay
            </h3>
            <dl className="mt-2 space-y-1 text-sm">
              <SheetRow
                label="Room"
                value={`${invoice.staySnapshot.roomNumber} · ${invoice.staySnapshot.roomTypeName}`}
              />
              <SheetRow
                label="Check-in"
                value={
                  invoice.staySnapshot.actualCheckInTime
                    ? formatDateTime(invoice.staySnapshot.actualCheckInTime, locale)
                    : formatStayDate(invoice.staySnapshot.checkInDate, locale)
                }
              />
              <SheetRow
                label="Check-out"
                value={
                  invoice.staySnapshot.actualCheckOutTime
                    ? formatDateTime(invoice.staySnapshot.actualCheckOutTime, locale)
                    : formatStayDate(invoice.staySnapshot.checkOutDate, locale)
                }
              />
              <SheetRow
                label="Nights"
                value={String(invoice.staySnapshot.numberOfNights)}
              />
              <SheetRow
                label="Guests"
                value={`${invoice.staySnapshot.adults} adult(s)${
                  invoice.staySnapshot.children > 0
                    ? `, ${invoice.staySnapshot.children} child(ren)`
                    : ""
                }`}
              />
            </dl>
          </section>
        </div>

        <Separator className="my-6" />

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className="border-b last:border-0">
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatCurrency(line.unitPrice, money)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCurrency(line.amount, money)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <SheetRow label="Room charges" value={formatCurrency(invoice.roomCharges, money)} />
            {invoice.additionalCharges > 0 && (
              <SheetRow
                label="Additional charges"
                value={formatCurrency(invoice.additionalCharges, money)}
              />
            )}
            <SheetRow label="Subtotal" value={formatCurrency(invoice.subtotal, money)} />
            {invoice.discount > 0 && (
              <SheetRow
                label="Discount"
                value={`− ${formatCurrency(invoice.discount, money)}`}
              />
            )}
            <SheetRow
              label={`Tax (${invoice.taxPercent}%)`}
              value={formatCurrency(invoice.tax, money)}
            />

            <Separator className="my-1" />
            <div className="flex items-baseline justify-between">
              <dt className="font-semibold">Total</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatCurrency(invoice.totalAmount, money)}
              </dd>
            </div>
            <SheetRow label="Amount paid" value={formatCurrency(invoice.amountPaid, money)} />
            <div className="flex items-baseline justify-between border-t pt-2">
              <dt className="font-semibold">Balance due</dt>
              <dd className="font-semibold tabular-nums">
                {formatCurrency(invoice.balanceDue, money)}
              </dd>
            </div>
          </dl>
        </div>

        {payments.length > 0 && (
          <>
            <Separator className="my-6" />
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payments received
              </h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment._id} className="border-b last:border-0">
                      <td className="py-1.5">{payment.paymentId}</td>
                      <td className="py-1.5 text-muted-foreground">
                        {formatStayDate(payment.paymentDate, locale)}
                      </td>
                      <td className="py-1.5">{label(payment.method)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {payment.kind === "REFUND" ? "−" : ""}
                        {formatCurrency(payment.amount, money)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {invoice.notes && (
          <p className="mt-6 text-sm text-muted-foreground">{invoice.notes}</p>
        )}

        <Separator className="my-6" />
        <p className="text-center text-xs text-muted-foreground">
          {invoiceFooter ?? "Thank you for staying with us."}
        </p>
      </article>
    </>
  );
}

function SheetRow({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{rowLabel}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
