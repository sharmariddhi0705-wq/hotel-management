"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Ellipsis, Layers, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FieldError } from "@/components/shared/field-error";
import { useListFilters } from "@/hooks/use-list-filters";
import { formResolver } from "@/lib/form";
import { roomTypeSchema, type RoomTypeInput } from "@/schemas/room";
import { AMENITIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";

export interface RoomTypeRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  bedType?: string;
  sizeSqft?: number;
  amenities: string[];
  isActive: boolean;
  roomCount: number;
}

interface RoomTypesManagerProps {
  roomTypes: RoomTypeRow[];
  meta: PaginationMeta;
  currency: string;
  locale: string;
  canManage: boolean;
}

function defaultsFor(type?: RoomTypeRow): RoomTypeInput {
  return {
    name: type?.name ?? "",
    description: type?.description ?? "",
    basePrice: type?.basePrice ?? 0,
    capacityAdults: type?.capacityAdults ?? 2,
    capacityChildren: type?.capacityChildren ?? 1,
    bedType: type?.bedType ?? "",
    sizeSqft: type?.sizeSqft,
    amenities: type?.amenities ?? [],
    images: [],
    isActive: type?.isActive ?? true,
  };
}

export function RoomTypesManager({
  roomTypes,
  meta,
  currency,
  locale,
  canManage,
}: RoomTypesManagerProps) {
  const router = useRouter();
  const filters = useListFilters();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RoomTypeRow | undefined>();
  const [deleting, setDeleting] = React.useState<RoomTypeRow | undefined>();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoomTypeInput>({
    resolver: formResolver(roomTypeSchema),
    defaultValues: defaultsFor(),
  });

  React.useEffect(() => {
    if (formOpen) reset(defaultsFor(editing));
  }, [formOpen, editing, reset]);

  const amenities = watch("amenities") ?? [];

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(type: RoomTypeRow) {
    setEditing(type);
    setFormOpen(true);
  }

  async function onSubmit(values: RoomTypeInput) {
    try {
      const { message } = editing
        ? await api.patch(`/api/room-types/${editing._id}`, values)
        : await api.post("/api/room-types", values);
      toast.success(message);
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the room type.");
      }
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { message } = await api.delete(`/api/room-types/${deleting._id}`);
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not delete the room type.",
      );
    }
  }

  return (
    <>
      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search room types…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{}}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
        >
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add room type
            </Button>
          )}
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {roomTypes.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No room types yet"
              description="Room types set the base rate and occupancy for the rooms assigned to them."
              action={
                canManage ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    Add room type
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Base rate</TableHead>
                      <TableHead className="text-right">Sleeps</TableHead>
                      <TableHead>Bed</TableHead>
                      <TableHead className="text-right">Rooms</TableHead>
                      <TableHead>Amenities</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomTypes.map((type) => (
                      <TableRow key={type._id} className={type.isActive ? "" : "opacity-60"}>
                        <TableCell>
                          <p className="font-medium">{type.name}</p>
                          {type.description && (
                            <p className="max-w-xs truncate text-xs text-muted-foreground">
                              {type.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(type.basePrice, { currency, locale })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {type.capacityAdults + type.capacityChildren}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {type.bedType || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{type.roomCount}</TableCell>
                        <TableCell>
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {type.amenities.slice(0, 2).map((amenity) => (
                              <Badge key={amenity} variant="secondary">
                                {amenity}
                              </Badge>
                            ))}
                            {type.amenities.length > 2 && (
                              <Badge variant="outline">+{type.amenities.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${type.name}`}
                                >
                                  <Ellipsis className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(type)}>
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleting(type)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="room types" />
            </>
          )}
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a room type"}</DialogTitle>
            <DialogDescription>
              Room types define the base rate and occupancy that new rooms inherit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Deluxe" {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="basePrice">Base rate per night</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  {...register("basePrice")}
                />
                <FieldError message={errors.basePrice?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacityAdults">Adults</Label>
                <Input
                  id="capacityAdults"
                  type="number"
                  min={1}
                  {...register("capacityAdults")}
                />
                <FieldError message={errors.capacityAdults?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacityChildren">Children</Label>
                <Input
                  id="capacityChildren"
                  type="number"
                  min={0}
                  {...register("capacityChildren")}
                />
                <FieldError message={errors.capacityChildren?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bedType">Bed type</Label>
                <Input id="bedType" placeholder="King" {...register("bedType")} />
                <FieldError message={errors.bedType?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sizeSqft">Size (sq ft)</Label>
                <Input id="sizeSqft" type="number" min={0} {...register("sizeSqft")} />
                <FieldError message={errors.sizeSqft?.message} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="typeDescription">Description</Label>
              <Textarea
                id="typeDescription"
                rows={2}
                placeholder="Spacious room with a king bed, balcony and rain shower."
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Standard amenities</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {AMENITIES.map((amenity) => (
                  <label key={amenity} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={amenities.includes(amenity)}
                      onCheckedChange={(checked) =>
                        setValue(
                          "amenities",
                          checked === true
                            ? [...amenities, amenity]
                            : amenities.filter((a) => a !== amenity),
                          { shouldDirty: true },
                        )
                      }
                    />
                    <span className="truncate">{amenity}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="typeActive" className="text-sm">
                  Available for new rooms
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive types stay on existing rooms but cannot be chosen again.
                </p>
              </div>
              <Switch
                id="typeActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Create room type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting && deleting.roomCount > 0
            ? `${deleting.roomCount} room(s) use this type, so it cannot be deleted until they are reassigned.`
            : "This room type will be removed permanently."
        }
        confirmLabel="Delete room type"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
