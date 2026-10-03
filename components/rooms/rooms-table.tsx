"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar, enumOptions } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { SortableHeader } from "@/components/shared/sortable-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoomFormDialog, type RoomTypeOption } from "@/components/rooms/room-form";
import { useListFilters } from "@/hooks/use-list-filters";
import { HOUSEKEEPING_STATUSES, ROOM_STATUSES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";

export interface RoomRow {
  _id: string;
  roomNumber: string;
  floor: number;
  pricePerNight: number;
  status: string;
  housekeepingStatus: string;
  maxOccupancy: number;
  amenities: string[];
  description?: string;
  isActive: boolean;
  roomType?: { _id: string; name: string } | null;
  assignedHousekeeper?: { firstName: string; lastName: string } | null;
}

interface RoomsTableProps {
  rooms: RoomRow[];
  meta: PaginationMeta;
  roomTypes: RoomTypeOption[];
  floors: number[];
  currency: string;
  locale: string;
  permissions: { create: boolean; update: boolean; remove: boolean };
  /** Set by the dashboard "Add room" shortcut (`/rooms?new=1`). */
  openNewOnMount?: boolean;
}

export function RoomsTable({
  rooms,
  meta,
  roomTypes,
  floors,
  currency,
  locale,
  permissions,
  openNewOnMount = false,
}: RoomsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useListFilters();

  const [formOpen, setFormOpen] = React.useState(openNewOnMount);
  const [editing, setEditing] = React.useState<RoomRow | undefined>();
  const [deleting, setDeleting] = React.useState<RoomRow | undefined>();

  // Clear the ?new=1 shortcut from the URL so a refresh does not reopen the form.
  React.useEffect(() => {
    if (!openNewOnMount) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    router.replace(`/rooms${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [openNewOnMount, router, searchParams]);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(room: RoomRow) {
    setEditing(room);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { message } = await api.delete(`/api/rooms/${deleting._id}`);
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not delete the room.",
      );
    }
  }

  const sort = filters.get("sort");
  const order = filters.get("order");

  return (
    <>
      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search room number…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{
            status: filters.get("status"),
            housekeepingStatus: filters.get("housekeepingStatus"),
            roomType: filters.get("roomType"),
            floor: filters.get("floor"),
          }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            { key: "status", placeholder: "Any status", options: enumOptions(ROOM_STATUSES) },
            {
              key: "housekeepingStatus",
              placeholder: "Any cleaning state",
              options: enumOptions(HOUSEKEEPING_STATUSES),
            },
            {
              key: "roomType",
              placeholder: "Any room type",
              options: roomTypes.map((t) => ({ value: t._id, label: t.name })),
            },
            {
              key: "floor",
              placeholder: "Any floor",
              options: floors.map((f) => ({ value: String(f), label: `Floor ${f}` })),
              width: "w-full sm:w-32",
            },
          ]}
        >
          {permissions.create && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add room
            </Button>
          )}
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {rooms.length === 0 ? (
            <EmptyState
              icon={BedDouble}
              title="No rooms match those filters"
              description={
                filters.activeFilterCount > 0
                  ? "Try clearing the filters, or widen your search."
                  : "Add your first room to start taking reservations."
              }
              action={
                permissions.create && filters.activeFilterCount === 0 ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    Add room
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
                      <SortableHeader
                        field="roomNumber"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Room
                      </SortableHeader>
                      <TableHead>Type</TableHead>
                      <SortableHeader
                        field="floor"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Floor
                      </SortableHeader>
                      <SortableHeader
                        field="pricePerNight"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                        className="text-right"
                      >
                        Rate
                      </SortableHeader>
                      <TableHead>Status</TableHead>
                      <TableHead>Cleaning</TableHead>
                      <TableHead className="text-right">Sleeps</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => (
                      <TableRow key={room._id} className={room.isActive ? "" : "opacity-60"}>
                        <TableCell>
                          <Link
                            href={`/rooms/${room._id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {room.roomNumber}
                          </Link>
                          {!room.isActive && (
                            <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {room.roomType?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {room.floor}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(room.pricePerNight, { currency, locale })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={room.status} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={room.housekeepingStatus} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {room.maxOccupancy}
                        </TableCell>
                        <TableCell>
                          {(permissions.update || permissions.remove) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for room ${room.roomNumber}`}
                                >
                                  <Ellipsis className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/rooms/${room._id}`}>View details</Link>
                                </DropdownMenuItem>
                                {permissions.update && (
                                  <DropdownMenuItem onClick={() => openEdit(room)}>
                                    <Pencil className="size-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {permissions.remove && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleting(room)}
                                  >
                                    <Trash2 className="size-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="rooms" />
            </>
          )}
        </Card>
      </div>

      <RoomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        roomTypes={roomTypes}
        room={
          editing
            ? {
                _id: editing._id,
                roomNumber: editing.roomNumber,
                roomType: editing.roomType?._id ?? "",
                floor: editing.floor,
                pricePerNight: editing.pricePerNight,
                status: editing.status as never,
                housekeepingStatus: editing.housekeepingStatus as never,
                maxOccupancy: editing.maxOccupancy,
                amenities: editing.amenities,
                description: editing.description,
                isActive: editing.isActive,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete room ${deleting?.roomNumber}?`}
        description="Rooms with past reservations are retired instead of deleted, so invoice history stays intact. This cannot be undone."
        confirmLabel="Delete room"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
