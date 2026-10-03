"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { guestSchema, type GuestInput } from "@/schemas/guest";
import { GENDERS, ID_TYPES, label } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";
import { toDateInputValue } from "@/lib/format";

export interface EditableGuest {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  notes?: string;
  isVip?: boolean;
  blacklisted?: boolean;
}

interface GuestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest?: EditableGuest;
  /** Called with the saved guest instead of refreshing — used by the booking wizard. */
  onSaved?: (guest: { _id: string; firstName: string; lastName: string; phone: string }) => void;
}

/**
 * `dateOfBirth` is handled as a `YYYY-MM-DD` string because that is what a
 * native date input produces; the Zod schema coerces it to a Date on submit.
 */
type GuestFormValues = Omit<GuestInput, "dateOfBirth"> & { dateOfBirth?: string };

function defaultsFor(guest?: EditableGuest): GuestFormValues {
  return {
    firstName: guest?.firstName ?? "",
    lastName: guest?.lastName ?? "",
    email: guest?.email ?? "",
    phone: guest?.phone ?? "",
    dateOfBirth: toDateInputValue(guest?.dateOfBirth),
    gender: (guest?.gender as GuestInput["gender"]) ?? "UNDISCLOSED",
    address: guest?.address ?? "",
    city: guest?.city ?? "",
    state: guest?.state ?? "",
    country: guest?.country ?? "",
    postalCode: guest?.postalCode ?? "",
    idType: guest?.idType as GuestInput["idType"],
    idNumber: guest?.idNumber ?? "",
    nationality: guest?.nationality ?? "",
    notes: guest?.notes ?? "",
    isVip: guest?.isVip ?? false,
    blacklisted: guest?.blacklisted ?? false,
  };
}

export function GuestFormDialog({
  open,
  onOpenChange,
  guest,
  onSaved,
}: GuestFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(guest?._id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GuestFormValues>({
    resolver: formResolver(guestSchema as never),
    defaultValues: defaultsFor(guest),
  });

  React.useEffect(() => {
    if (open) reset(defaultsFor(guest));
  }, [open, guest, reset]);

  async function onSubmit(values: GuestFormValues) {
    // An empty date input must be omitted, not sent as "".
    const payload = { ...values, dateOfBirth: values.dateOfBirth || undefined };

    try {
      const response = isEdit
        ? await api.patch<{ _id: string; firstName: string; lastName: string; phone: string }>(
            `/api/guests/${guest!._id}`,
            payload,
          )
        : await api.post<{ _id: string; firstName: string; lastName: string; phone: string }>(
            "/api/guests",
            payload,
          );

      toast.success(response.message);
      onOpenChange(false);

      if (onSaved) onSaved(response.data);
      else router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the guest.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${guest?.firstName} ${guest?.lastName}` : "Add a guest"}
          </DialogTitle>
          <DialogDescription>
            Only a name and a phone number are required. Identification is recorded at
            check-in if it is not on file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
              <FieldError message={errors.lastName?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guestPhone">Phone</Label>
              <Input id="guestPhone" placeholder="+91 98765 43210" {...register("phone")} />
              <FieldError message={errors.phone?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guestEmail">Email (optional)</Label>
              <Input id="guestEmail" type="email" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
              <FieldError message={errors.dateOfBirth?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={watch("gender")}
                onValueChange={(value) => setValue("gender", value as GuestInput["gender"])}
              >
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {label(gender)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" placeholder="Indian" {...register("nationality")} />
              <FieldError message={errors.nationality?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idType">ID type</Label>
              <Select
                value={watch("idType") ?? ""}
                onValueChange={(value) => setValue("idType", value as GuestInput["idType"])}
              >
                <SelectTrigger id="idType" className="w-full">
                  <SelectValue placeholder="Not recorded" />
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="idNumber">ID number</Label>
              <Input id="idNumber" {...register("idNumber")} />
              <FieldError message={errors.idNumber?.message} />
            </div>
          </div>

          <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <legend className="sr-only">Address</legend>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" autoComplete="street-address" {...register("address")} />
              <FieldError message={errors.address?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State / region</Label>
              <Input id="state" {...register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register("country")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register("postalCode")} />
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="guestNotes">Internal notes</Label>
            <Textarea
              id="guestNotes"
              rows={2}
              placeholder="Prefers a quiet room away from the lift."
              {...register("notes")}
            />
            <FieldError message={errors.notes?.message} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label htmlFor="isVip" className="text-sm">
                VIP guest
              </Label>
              <Switch
                id="isVip"
                checked={watch("isVip")}
                onCheckedChange={(checked) => setValue("isVip", checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="blacklisted" className="text-sm">
                  Blacklisted
                </Label>
                <p className="text-xs text-muted-foreground">Blocks new bookings.</p>
              </div>
              <Switch
                id="blacklisted"
                checked={watch("blacklisted")}
                onCheckedChange={(checked) => setValue("blacklisted", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
