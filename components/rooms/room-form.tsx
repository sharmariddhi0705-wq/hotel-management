"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { formResolver } from "@/lib/form";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { roomSchema, type RoomInput } from "@/schemas/room";
import { AMENITIES, HOUSEKEEPING_STATUSES, ROOM_STATUSES, label } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";

export interface RoomTypeOption {
  _id: string;
  name: string;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
}

export interface EditableRoom extends Partial<RoomInput> {
  _id?: string;
}

interface RoomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: RoomTypeOption[];
  /** Present when editing, absent when creating. */
  room?: EditableRoom;
}

function defaultsFor(room?: EditableRoom): RoomInput {
  return {
    roomNumber: room?.roomNumber ?? "",
    roomType: room?.roomType ?? "",
    floor: room?.floor ?? 1,
    pricePerNight: room?.pricePerNight ?? 0,
    status: room?.status ?? "AVAILABLE",
    housekeepingStatus: room?.housekeepingStatus ?? "CLEAN",
    maxOccupancy: room?.maxOccupancy ?? 2,
    amenities: room?.amenities ?? [],
    description: room?.description ?? "",
    images: room?.images ?? [],
    isActive: room?.isActive ?? true,
  };
}

export function RoomFormDialog({ open, onOpenChange, roomTypes, room }: RoomFormProps) {
  const router = useRouter();
  const isEdit = Boolean(room?._id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoomInput>({
    resolver: formResolver(roomSchema),
    defaultValues: defaultsFor(room),
  });

  // Re-seed the form whenever a different room is opened in the dialog.
  React.useEffect(() => {
    if (open) reset(defaultsFor(room));
  }, [open, room, reset]);

  const amenities = watch("amenities") ?? [];

  /**
   * Choosing a type pre-fills the nightly rate and occupancy from that type, so
   * the desk does not retype them. An existing room keeps its own values.
   */
  function onRoomTypeChange(value: string) {
    setValue("roomType", value, { shouldValidate: true });
    const type = roomTypes.find((t) => t._id === value);
    if (type && !isEdit) {
      setValue("pricePerNight", type.basePrice);
      setValue("maxOccupancy", type.capacityAdults + type.capacityChildren);
    }
  }

  function toggleAmenity(amenity: string, checked: boolean) {
    setValue(
      "amenities",
      checked ? [...amenities, amenity] : amenities.filter((a) => a !== amenity),
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: RoomInput) {
    try {
      const { message } = isEdit
        ? await api.patch(`/api/rooms/${room!._id}`, values)
        : await api.post("/api/rooms", values);

      toast.success(message);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the room.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit room ${room?.roomNumber}` : "Add a room"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this room."
              : "Create a new sellable room on the floor plan."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="roomNumber">Room number</Label>
              <Input id="roomNumber" placeholder="205" {...register("roomNumber")} />
              <FieldError message={errors.roomNumber?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roomType">Room type</Label>
              <Select value={watch("roomType")} onValueChange={onRoomTypeChange}>
                <SelectTrigger id="roomType" className="w-full">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type._id} value={type._id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.roomType?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor">Floor</Label>
              <Input id="floor" type="number" min={0} {...register("floor")} />
              <FieldError message={errors.floor?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pricePerNight">Price per night</Label>
              <Input
                id="pricePerNight"
                type="number"
                min={0}
                step="0.01"
                {...register("pricePerNight")}
              />
              <FieldError message={errors.pricePerNight?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxOccupancy">Sleeps</Label>
              <Input id="maxOccupancy" type="number" min={1} {...register("maxOccupancy")} />
              <FieldError message={errors.maxOccupancy?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Availability status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as RoomInput["status"])}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {label(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="housekeepingStatus">Cleaning status</Label>
              <Select
                value={watch("housekeepingStatus")}
                onValueChange={(value) =>
                  setValue("housekeepingStatus", value as RoomInput["housekeepingStatus"])
                }
              >
                <SelectTrigger id="housekeepingStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSEKEEPING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {label(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="isActive" className="text-sm">
                  In service
                </Label>
                <p className="text-xs text-muted-foreground">Inactive rooms cannot be sold.</p>
              </div>
              <Switch
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Corner room with a sea-facing balcony."
              {...register("description")}
            />
            <FieldError message={errors.description?.message} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Amenities</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {AMENITIES.map((amenity) => (
                <label key={amenity} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={amenities.includes(amenity)}
                    onCheckedChange={(checked) => toggleAmenity(amenity, checked === true)}
                  />
                  <span className="truncate">{amenity}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
