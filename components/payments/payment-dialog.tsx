"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/shared/field-error";
import { PAYMENT_METHODS, label, type PaymentMethod } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/api-client";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  reservationNumber: string;
  balanceDue: number;
  kind: "PAYMENT" | "REFUND";
}

/**
 * Records a payment or a refund.
 *
 * The amount is capped client-side for a fast signal, but the server is what
 * actually enforces "never more than the balance" and "never refund more than
 * was collected".
 */
export function PaymentDialog({
  open,
  onOpenChange,
  reservationId,
  reservationNumber,
  balanceDue,
  kind,
}: PaymentDialogProps) {
  const router = useRouter();
  const isRefund = kind === "REFUND";

  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("CASH");
  const [transactionId, setTransactionId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAmount(isRefund ? "" : balanceDue > 0 ? String(balanceDue) : "");
    setTransactionId("");
    setNotes("");
    setError(null);
  }, [open, isRefund, balanceDue]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { message } = await api.post("/api/payments", {
        reservation: reservationId,
        kind,
        amount: value,
        method,
        status: "COMPLETED",
        transactionId: transactionId || undefined,
        notes: notes || undefined,
        paymentDate: new Date().toISOString(),
      });
      toast.success(message);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Could not record that.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRefund ? "Record a refund" : "Take a payment"} · {reservationNumber}
          </DialogTitle>
          <DialogDescription>
            {isRefund
              ? "Refunds are stored as their own record, so both movements stay visible on the folio."
              : "The folio balance and payment status update automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {!isRefund && (
            <Alert>
              <AlertDescription>
                Outstanding balance: <strong>{balanceDue}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="paymentAmount">Amount</Label>
            <Input
              id="paymentAmount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </div>

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
            <Label htmlFor="paymentTransactionId">Transaction reference</Label>
            <Input
              id="paymentTransactionId"
              placeholder="UPI / card approval code"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paymentDialogNotes">Notes</Label>
            <Textarea
              id="paymentDialogNotes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <FieldError message={error ?? undefined} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="size-4 animate-spin" />}
              {isRefund ? "Record refund" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
