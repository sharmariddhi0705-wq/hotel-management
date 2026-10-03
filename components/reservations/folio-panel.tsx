"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";

export interface FolioCharge {
  _id: string;
  description: string;
  amount: number;
  quantity: number;
}

interface FolioPanelProps {
  reservationId: string;
  charges: FolioCharge[];
  totals: {
    numberOfNights: number;
    pricePerNight: number;
    roomCharges: number;
    subtotal: number;
    discount: number;
    taxPercent: number;
    tax: number;
    totalAmount: number;
    amountPaid: number;
    amountRefunded: number;
    balanceDue: number;
  };
  currency: string;
  locale: string;
  /** Charges are final once the stay has closed. */
  editable: boolean;
}

/**
 * The guest folio: room nights, extras, tax and what is still owed.
 *
 * Adding or removing a charge goes through the API, which recomputes every
 * derived amount server-side — this panel never does its own arithmetic on the
 * stored totals.
 */
export function FolioPanel({
  reservationId,
  charges,
  totals,
  currency,
  locale,
  editable,
}: FolioPanelProps) {
  const router = useRouter();
  const money = { currency, locale };
  const [addOpen, setAddOpen] = React.useState(false);
  const [busyChargeId, setBusyChargeId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({ description: "", amount: "", quantity: "1" });
  const [saving, setSaving] = React.useState(false);

  async function addCharge(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { message } = await api.post(`/api/reservations/${reservationId}/charges`, {
        description: draft.description,
        amount: Number(draft.amount),
        quantity: Number(draft.quantity),
      });
      toast.success(message);
      setAddOpen(false);
      setDraft({ description: "", amount: "", quantity: "1" });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not add the charge.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCharge(chargeId: string) {
    setBusyChargeId(chargeId);
    try {
      const { message } = await api.delete(
        `/api/reservations/${reservationId}/charges?chargeId=${chargeId}`,
      );
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not remove the charge.",
      );
    } finally {
      setBusyChargeId(null);
    }
  }

  return (
    <>
      <dl className="space-y-2 text-sm">
        <Row
          label={`Room charges — ${totals.numberOfNights} night(s) × ${formatCurrency(totals.pricePerNight, money)}`}
          value={formatCurrency(totals.roomCharges, money)}
        />

        {charges.length > 0 && (
          <>
            <Separator className="my-2" />
            {charges.map((charge) => (
              <div key={charge._id} className="flex items-baseline justify-between gap-2">
                <dt className="min-w-0 text-muted-foreground">
                  {charge.description}
                  {charge.quantity > 1 && ` × ${charge.quantity}`}
                </dt>
                <dd className="flex shrink-0 items-center gap-1.5">
                  <span className="font-medium tabular-nums">
                    {formatCurrency(charge.amount * charge.quantity, money)}
                  </span>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${charge.description}`}
                      disabled={busyChargeId === charge._id}
                      onClick={() => removeCharge(charge._id)}
                    >
                      {busyChargeId === charge._id ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  )}
                </dd>
              </div>
            ))}
          </>
        )}

        <Separator className="my-2" />
        <Row label="Subtotal" value={formatCurrency(totals.subtotal, money)} />
        {totals.discount > 0 && (
          <Row
            label="Discount"
            value={`− ${formatCurrency(totals.discount, money)}`}
            tone="positive"
          />
        )}
        <Row
          label={`Tax (${totals.taxPercent}%)`}
          value={formatCurrency(totals.tax, money)}
        />

        <Separator className="my-2" />
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">Total</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatCurrency(totals.totalAmount, money)}
          </dd>
        </div>

        <Row
          label="Paid"
          value={formatCurrency(totals.amountPaid, money)}
          tone="positive"
        />
        {totals.amountRefunded > 0 && (
          <Row
            label="Refunded"
            value={formatCurrency(totals.amountRefunded, money)}
            tone="negative"
          />
        )}

        <div className="flex items-baseline justify-between border-t pt-2">
          <dt className="font-semibold">Balance due</dt>
          <dd
            className={
              totals.balanceDue > 0
                ? "text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400"
                : "text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
            }
          >
            {formatCurrency(totals.balanceDue, money)}
          </dd>
        </div>
      </dl>

      {editable && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          Add a charge
        </Button>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a charge</DialogTitle>
            <DialogDescription>
              Posted to the folio and taxed with the rest of the bill.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={addCharge} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="chargeDescription">Description</Label>
              <Input
                id="chargeDescription"
                required
                minLength={2}
                placeholder="Minibar"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="chargeAmount">Unit amount</Label>
                <Input
                  id="chargeAmount"
                  type="number"
                  required
                  min={0.01}
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chargeQuantity">Quantity</Label>
                <Input
                  id="chargeQuantity"
                  type="number"
                  min={1}
                  step="1"
                  value={draft.quantity}
                  onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Add charge
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "";

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}
