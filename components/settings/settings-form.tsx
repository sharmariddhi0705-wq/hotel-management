"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Building2, LoaderCircle, Receipt, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/shared/field-error";
import { formResolver } from "@/lib/form";
import { hotelSettingsSchema, type HotelSettingsInput } from "@/schemas/settings";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";

interface SettingsFormProps {
  values: HotelSettingsInput;
  canManage: boolean;
}

/**
 * Hotel-wide configuration.
 *
 * The tax rate and currency here feed every new folio and invoice, so changing
 * them affects future bills only — issued invoices keep the values snapshotted
 * onto them.
 */
export function SettingsForm({ values, canManage }: SettingsFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HotelSettingsInput>({
    resolver: formResolver(hotelSettingsSchema),
    defaultValues: values,
  });

  async function onSubmit(next: HotelSettingsInput) {
    try {
      const { message } = await api.patch("/api/settings", next);
      toast.success(message);
      reset(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the settings.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {!canManage && (
        <Alert>
          <AlertDescription>
            You can view these settings but not change them. Ask an administrator.
          </AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!canManage} className="space-y-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" />
              Property
            </CardTitle>
            <CardDescription>
              Shown in the sidebar and printed on every invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hotelName">Hotel name</Label>
              <Input id="hotelName" {...register("hotelName")} />
              <FieldError message={errors.hotelName?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalName">Legal name</Label>
              <Input id="legalName" {...register("legalName")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" {...register("tagline")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="settingsAddress">Address</Label>
              <Input id="settingsAddress" {...register("address")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsCity">City</Label>
              <Input id="settingsCity" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsState">State</Label>
              <Input id="settingsState" {...register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsCountry">Country</Label>
              <Input id="settingsCountry" {...register("country")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsPostalCode">Postal code</Label>
              <Input id="settingsPostalCode" {...register("postalCode")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsPhone">Phone</Label>
              <Input id="settingsPhone" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsEmail">Email</Label>
              <Input id="settingsEmail" type="email" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settingsWebsite">Website</Label>
              <Input id="settingsWebsite" {...register("website")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input id="taxId" {...register("taxId")} />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4" />
              Operations
            </CardTitle>
            <CardDescription>
              Locale, currency and the tax rate applied to new folios.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency code</Label>
              <Input id="currency" maxLength={3} placeholder="INR" {...register("currency")} />
              <FieldError message={errors.currency?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currencySymbol">Symbol</Label>
              <Input id="currencySymbol" maxLength={4} {...register("currencySymbol")} />
              <FieldError message={errors.currencySymbol?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locale">Locale</Label>
              <Input id="locale" placeholder="en-IN" {...register("locale")} />
              <FieldError message={errors.locale?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" placeholder="Asia/Kolkata" {...register("timezone")} />
              <FieldError message={errors.timezone?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxPercent">Tax rate (%)</Label>
              <Input
                id="taxPercent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...register("taxPercent")}
              />
              <FieldError message={errors.taxPercent?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkInTime">Check-in time</Label>
              <Input id="checkInTime" placeholder="14:00" {...register("checkInTime")} />
              <FieldError message={errors.checkInTime?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOutTime">Check-out time</Label>
              <Input id="checkOutTime" placeholder="11:00" {...register("checkOutTime")} />
              <FieldError message={errors.checkOutTime?.message} />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" />
              Invoicing & policy
            </CardTitle>
            <CardDescription>
              Changing the prefix affects invoices issued from now on; existing numbers
              stay as they were.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoicePrefix">Invoice prefix</Label>
                <Input id="invoicePrefix" maxLength={8} {...register("invoicePrefix")} />
                <FieldError message={errors.invoicePrefix?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" {...register("logoUrl")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceFooter">Invoice footer</Label>
              <Textarea id="invoiceFooter" rows={2} {...register("invoiceFooter")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cancellationPolicy">Cancellation policy</Label>
              <Textarea id="cancellationPolicy" rows={3} {...register("cancellationPolicy")} />
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {canManage && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset(values)}
            disabled={!isDirty || isSubmitting}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      )}
    </form>
  );
}
