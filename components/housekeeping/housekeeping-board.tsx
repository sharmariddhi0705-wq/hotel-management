"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BrushCleaning,
  Check,
  LoaderCircle,
  LogIn,
  LogOut,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar, enumOptions } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useListFilters } from "@/hooks/use-list-filters";
import { HOUSEKEEPING_STATUSES, ROOM_STATUSES, label } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";

export interface BoardRoom {
  _id: string;
  roomNumber: string;
  floor: number;
  status: string;
  housekeepingStatus: string;
  housekeepingNotes?: string;
  lastCleanedAt?: string | null;
  roomType?: { name: string } | null;
  assignedHousekeeper?: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  } | null;
  openTask?: { _id: string; taskCode: string; type: string; status: string; priority: string } | null;
  departingToday: boolean;
  arrivingToday: boolean;
}

export interface HousekeeperOption {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
}

interface HousekeepingBoardProps {
  rooms: BoardRoom[];
  meta: PaginationMeta;
  housekeepers: HousekeeperOption[];
  floors: number[];
  locale: string;
  permissions: { update: boolean; assign: boolean };
}

/**
 * The floor board.
 *
 * Marking a room clean is the action that returns it to the sellable pool, so it
 * is the primary button on every card. Whether the room actually becomes
 * available is decided server-side — a room with a guest still in it never does.
 */
export function HousekeepingBoard({
  rooms,
  meta,
  housekeepers,
  floors,
  locale,
  permissions,
}: HousekeepingBoardProps) {
  const router = useRouter();
  const filters = useListFilters();
  const [busyRoomId, setBusyRoomId] = React.useState<string | null>(null);
  const [notesRoom, setNotesRoom] = React.useState<BoardRoom | null>(null);
  const [notesDraft, setNotesDraft] = React.useState("");
  const [maintenanceRoom, setMaintenanceRoom] = React.useState<BoardRoom | null>(null);

  async function patchRoom(roomId: string, body: Record<string, unknown>) {
    setBusyRoomId(roomId);
    try {
      const { message } = await api.patch(`/api/housekeeping/rooms/${roomId}`, body);
      toast.success(message);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not update the room.",
      );
      return false;
    } finally {
      setBusyRoomId(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search room number…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{
            housekeepingStatus: filters.get("housekeepingStatus"),
            status: filters.get("status"),
            floor: filters.get("floor"),
            assignedHousekeeper: filters.get("assignedHousekeeper"),
          }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            {
              key: "housekeepingStatus",
              placeholder: "Any cleaning state",
              options: enumOptions(HOUSEKEEPING_STATUSES),
            },
            {
              key: "status",
              placeholder: "Any room status",
              options: enumOptions(ROOM_STATUSES),
            },
            {
              key: "floor",
              placeholder: "Any floor",
              options: floors.map((f) => ({ value: String(f), label: `Floor ${f}` })),
              width: "w-full sm:w-32",
            },
            {
              key: "assignedHousekeeper",
              placeholder: "Anyone",
              options: [
                { value: "unassigned", label: "Unassigned" },
                ...housekeepers.map((h) => ({
                  value: h._id,
                  label: `${h.firstName} ${h.lastName}`,
                })),
              ],
            },
          ]}
        />

        {rooms.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={BrushCleaning}
              title="No rooms match those filters"
              description="Clear the filters to see the whole floor board."
            />
          </Card>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const busy = busyRoomId === room._id;
                const isClean = ["CLEAN", "INSPECTED"].includes(room.housekeepingStatus);

                return (
                  <li key={room._id}>
                    <Card className="h-full gap-0 py-4">
                      <CardContent className="flex h-full flex-col px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/rooms/${room._id}`}
                              className="font-semibold underline-offset-4 hover:underline"
                            >
                              Room {room.roomNumber}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Floor {room.floor} · {room.roomType?.name ?? "Unclassified"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge status={room.status} />
                            <StatusBadge status={room.housekeepingStatus} />
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {room.departingToday && (
                            <Badge variant="outline">
                              <LogOut className="size-3" />
                              Departing today
                            </Badge>
                          )}
                          {room.arrivingToday && (
                            <Badge variant="outline">
                              <LogIn className="size-3" />
                              Arriving today
                            </Badge>
                          )}
                          {room.openTask && (
                            <Badge variant="secondary">
                              {label(room.openTask.type)} · {label(room.openTask.status)}
                            </Badge>
                          )}
                        </div>

                        <dl className="mt-3 space-y-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Assigned</dt>
                            <dd className="truncate font-medium">
                              {room.assignedHousekeeper
                                ? `${room.assignedHousekeeper.firstName} ${room.assignedHousekeeper.lastName}`
                                : "Unassigned"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Last cleaned</dt>
                            <dd className="font-medium">
                              {formatDateTime(room.lastCleanedAt, locale)}
                            </dd>
                          </div>
                        </dl>

                        {room.housekeepingNotes && (
                          <p className="mt-2 line-clamp-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                            {room.housekeepingNotes}
                          </p>
                        )}

                        {permissions.assign && (
                          <div className="mt-3">
                            <Label
                              htmlFor={`assign-${room._id}`}
                              className="text-xs text-muted-foreground"
                            >
                              Assign to
                            </Label>
                            <Select
                              value={room.assignedHousekeeper?._id ?? "unassigned"}
                              onValueChange={(value) =>
                                patchRoom(room._id, {
                                  assignedHousekeeper: value === "unassigned" ? null : value,
                                })
                              }
                            >
                              <SelectTrigger
                                id={`assign-${room._id}`}
                                className="mt-1 w-full"
                                disabled={busy}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {housekeepers.map((keeper) => (
                                  <SelectItem key={keeper._id} value={keeper._id}>
                                    {keeper.firstName} {keeper.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {permissions.update && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                            {!isClean && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  patchRoom(room._id, { housekeepingStatus: "CLEAN" })
                                }
                              >
                                {busy ? (
                                  <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                  <Check className="size-4" />
                                )}
                                Mark clean
                              </Button>
                            )}
                            {room.housekeepingStatus !== "IN_PROGRESS" && !isClean && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  patchRoom(room._id, { housekeepingStatus: "IN_PROGRESS" })
                                }
                              >
                                Start
                              </Button>
                            )}
                            {isClean && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  patchRoom(room._id, { housekeepingStatus: "DIRTY" })
                                }
                              >
                                Mark dirty
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setNotesRoom(room);
                                setNotesDraft(room.housekeepingNotes ?? "");
                              }}
                            >
                              Notes
                            </Button>
                            {room.status !== "MAINTENANCE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setMaintenanceRoom(room)}
                              >
                                <Wrench className="size-4" />
                                Maintenance
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>

            <Card className="p-0">
              <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="rooms" />
            </Card>
          </>
        )}
      </div>

      <Dialog
        open={Boolean(notesRoom)}
        onOpenChange={(open) => !open && setNotesRoom(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for room {notesRoom?.roomNumber}</DialogTitle>
            <DialogDescription>
              Visible to housekeeping and the front desk.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Shower head needs descaling; guest asked for extra towels."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesRoom(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!notesRoom) return;
                const ok = await patchRoom(notesRoom._id, {
                  housekeepingNotes: notesDraft,
                });
                if (ok) setNotesRoom(null);
              }}
            >
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(maintenanceRoom)}
        onOpenChange={(open) => !open && setMaintenanceRoom(null)}
        title={`Flag room ${maintenanceRoom?.roomNumber} for maintenance?`}
        description="The room is taken out of service and an urgent maintenance task is raised. It cannot be sold until the work is closed."
        confirmLabel="Flag for maintenance"
        destructive
        onConfirm={async () => {
          if (!maintenanceRoom) return;
          await patchRoom(maintenanceRoom._id, { markMaintenance: true });
          setMaintenanceRoom(null);
        }}
      />
    </>
  );
}
