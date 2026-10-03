"use client";

import { ArrowLeft, LoaderCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PAYMENT_METHODS, label } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/constants";

export interface PaymentDraft {
  takeDeposit: boolean;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  notes: string;
  /** CONFIRMED when true, PENDING when false. */
  confirmNow: boolean;
}

interface StepPaymentProps {
  value: PaymentDraft;
  onChange: (draft: PaymentDraft) => void;
  total: number;
  currency: string;
  locale: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

const QUICK_AMOUNTS = [
  { label: "25%", fraction: 0.25 },
  { label: "50%", fraction: 0.5 },
  { label: "Full amount", fraction: 1 },
];

export function StepPayment({
  value,
  onChange,
  total,
  currency,
  locale,
  submitting,
  onBack,
  onSubmit,
}: StepPaymentProps) {
  const money = { currency, locale };
  const overpaying = value.takeDeposit && value.amount > total;

  function update<K extends keyof PaymentDraft>(key: K, next: PaymentDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Payment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a deposit now, or leave the folio unpaid and settle at check-in.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Amount due</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatCurrency(total, money)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div>
          <Label htmlFor="takeDeposit" className="text-sm">
            Take a payment now
          </Label>
          <p className="text-xs text-muted-foreground">
            Recorded against the folio immediately.
          </p>
        </div>
        <Switch
          id="takeDeposit"
          checked={value.takeDeposit}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              takeDeposit: checked,
              amount: checked && value.amount === 0 ? Math.round(total * 0.25 * 100) / 100 : value.amount,
            })
          }
        />
      </div>

      {value.takeDeposit && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="depositAmount">Amount received</Label>
            <Input
              id="depositAmount"
              type="number"
              min={0}
              max={total}
              step="0.01"
              value={value.amount}
              onChange={(event) => update("amount", Number(event.target.value))}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_AMOUNTS.map((quick) => (
                <Button
                  key={quick.label}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    update("amount", Math.round(total * quick.fraction * 100) / 100)
                  }
                >
                  {quick.label}
                </Button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Method</legend>
            <RadioGroup
              value={value.method}
              onValueChange={(next) => update("method", next as PaymentMethod)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/50"
                >
                  <RadioGroupItem value={method} />
                  {label(method)}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="transactionId">Transaction reference</Label>
              <Input
                id="transactionId"
                placeholder="UPI / card approval code"
                value={value.transactionId}
                onChange={(event) => update("transactionId", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentNotes">Notes</Label>
              <Textarea
                id="paymentNotes"
                rows={1}
                value={value.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </div>
          </div>

          {overpaying && (
            <Alert variant="destructive">
              <AlertDescription>
                That is more than the amount due. Reduce it to{" "}
                {formatCurrency(total, money)} or less.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Balance after this payment</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(Math.max(0, total - value.amount), money)}
              </span>
            </div>
          </div>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div>
          <Label htmlFor="confirmNow" className="text-sm">
            Confirm the reservation
          </Label>
          <p className="text-xs text-muted-foreground">
            Turn this off to hold it as pending until the guest confirms.
          </p>
        </div>
        <Switch
          id="confirmNow"
          checked={value.confirmNow}
          onCheckedChange={(checked) => update("confirmNow", checked)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={submitting || overpaying}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Wallet className="size-4" />
          )}
          {submitting ? "Creating…" : "Create reservation"}
        </Button>
      </div>
    </div>
  );
}
