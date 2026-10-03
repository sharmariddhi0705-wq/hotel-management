"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/shared/field-error";
import { formResolver } from "@/lib/form";
import { cancelReservationSchema } from "@/schemas/reservation";
import { api, ApiClientError } from "@/lib/api-client";
import type { z } from "zod";

type CancelInput = z.infer<typeof cancelReservationSchema>;

interface CancelReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  reservationNumber: string;
  onCancelled: () => void;
}

/**
 * Cancelling frees the dates immediately. Money already taken is untouched —
 * refunds are recorded separately so the ledger shows who returned what.
 */
export function CancelReservationDialog({
  open,
  onOpenChange,
  reservationId,
  reservationNumber,
  onCancelled,
}: CancelReservationDialogProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CancelInput>({
    resolver: formResolver(cancelReservationSchema),
    defaultValues: { cancellationReason: "", markNoShow: false },
  });

  async function onSubmit(values: CancelInput) {
    try {
      const { message } = await api.post(
        `/api/reservations/${reservationId}/cancel`,
        values,
      );
      toast.success(message);
      onCancelled();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not cancel the reservation.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {reservationNumber}?</DialogTitle>
          <DialogDescription>
            The room is released for those dates straight away. Any payments already
            taken stay on the folio until you record a refund.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cancellationReason">Reason</Label>
            <Textarea
              id="cancellationReason"
              rows={3}
              placeholder="Guest changed their travel plans."
              {...register("cancellationReason")}
            />
            <FieldError message={errors.cancellationReason?.message} />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
            <Checkbox
              checked={watch("markNoShow")}
              onCheckedChange={(checked) => setValue("markNoShow", checked === true)}
            />
            <span className="text-sm">
              Record as a no-show
              <span className="block text-xs text-muted-foreground">
                Use this when the guest never arrived, rather than cancelling in advance.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Keep reservation
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              {watch("markNoShow") ? "Mark as no-show" : "Cancel reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
