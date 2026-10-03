"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Crown, Ellipsis, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { SortableHeader } from "@/components/shared/sortable-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { GuestFormDialog, type EditableGuest } from "@/components/guests/guest-form";
import { useListFilters } from "@/hooks/use-list-filters";
import { formatCurrency } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";

export interface GuestRow {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  city?: string;
  country?: string;
  nationality?: string;
  isVip: boolean;
  blacklisted: boolean;
  totalStays: number;
  totalSpend: number;
}

interface GuestsTableProps {
  guests: GuestRow[];
  meta: PaginationMeta;
  countries: string[];
  currency: string;
  locale: string;
  permissions: { create: boolean; update: boolean; remove: boolean };
  openNewOnMount?: boolean;
}

export function GuestsTable({
  guests,
  meta,
  countries,
  currency,
  locale,
  permissions,
  openNewOnMount = false,
}: GuestsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useListFilters();

  const [formOpen, setFormOpen] = React.useState(openNewOnMount);
  const [editing, setEditing] = React.useState<EditableGuest | undefined>();
  const [deleting, setDeleting] = React.useState<GuestRow | undefined>();

  React.useEffect(() => {
    if (!openNewOnMount) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    router.replace(`/guests${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [openNewOnMount, router, searchParams]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { message } = await api.delete(`/api/guests/${deleting._id}`);
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not remove the guest.",
      );
    }
  }

  const sort = filters.get("sort");
  const order = filters.get("order");

  return (
    <>
      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search name, email or phone…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{
            country: filters.get("country"),
            isVip: filters.get("isVip"),
            blacklisted: filters.get("blacklisted"),
          }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            {
              key: "country",
              placeholder: "Any country",
              options: countries.map((c) => ({ value: c, label: c })),
            },
            {
              key: "isVip",
              placeholder: "All guests",
              options: [{ value: "true", label: "VIP only" }],
              width: "w-full sm:w-36",
            },
            {
              key: "blacklisted",
              placeholder: "Not filtered",
              options: [
                { value: "true", label: "Blacklisted" },
                { value: "false", label: "Not blacklisted" },
              ],
              width: "w-full sm:w-40",
            },
          ]}
        >
          {permissions.create && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add guest
            </Button>
          )}
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {guests.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No guests match those filters"
              description={
                filters.activeFilterCount > 0
                  ? "Try clearing the filters, or search by phone number."
                  : "Guest profiles are created here or during a booking."
              }
              action={
                permissions.create && filters.activeFilterCount === 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(undefined);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add guest
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
                        field="lastName"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Guest
                      </SortableHeader>
                      <TableHead>Contact</TableHead>
                      <TableHead>From</TableHead>
                      <SortableHeader
                        field="totalStays"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                        className="text-right"
                      >
                        Stays
                      </SortableHeader>
                      <SortableHeader
                        field="totalSpend"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                        className="text-right"
                      >
                        Lifetime spend
                      </SortableHeader>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map((guest) => (
                      <TableRow key={guest._id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/guests/${guest._id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {guest.firstName} {guest.lastName}
                            </Link>
                            {guest.isVip && (
                              <Crown
                                className="size-3.5 text-amber-500"
                                aria-label="VIP guest"
                              />
                            )}
                            {guest.blacklisted && (
                              <Badge variant="destructive">Blacklisted</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{guest.phone}</p>
                          {guest.email && (
                            <p className="max-w-52 truncate text-xs text-muted-foreground">
                              {guest.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {[guest.city, guest.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {guest.totalStays}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(guest.totalSpend, { currency, locale })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${guest.firstName} ${guest.lastName}`}
                              >
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/guests/${guest._id}`}>View profile</Link>
                              </DropdownMenuItem>
                              {permissions.update && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(guest);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {permissions.remove && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleting(guest)}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="guests" />
            </>
          )}
        </Card>
      </div>

      <GuestFormDialog open={formOpen} onOpenChange={setFormOpen} guest={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Remove ${deleting?.firstName} ${deleting?.lastName}?`}
        description="Guests with stay history cannot be removed, because past invoices reference them."
        confirmLabel="Remove guest"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
