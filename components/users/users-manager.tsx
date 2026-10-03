"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Ellipsis, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ListToolbar, enumOptions } from "@/components/shared/list-toolbar";
import { DataPagination, type PaginationMeta } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FieldError } from "@/components/shared/field-error";
import { useListFilters } from "@/hooks/use-list-filters";
import { USER_ROLES, USER_STATUSES, label } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";

export interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  lastLoginAt?: string | null;
  createdAt: string;
  staff?: { employeeId: string; firstName: string; lastName: string; department: string } | null;
}

export interface StaffOption {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  department: string;
}

interface UsersManagerProps {
  users: UserRow[];
  meta: PaginationMeta;
  staff: StaffOption[];
  currentUserId: string;
  locale: string;
}

interface UserFormValues {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  phone: string;
  staff: string;
}

function defaultsFor(user?: UserRow): UserFormValues {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "RECEPTIONIST",
    status: user?.status ?? "ACTIVE",
    phone: user?.phone ?? "",
    staff: "none",
  };
}

/** Counts the permissions each role holds, for the role reference card. */
const ROLE_PERMISSION_COUNTS = USER_ROLES.map((role) => ({
  role,
  count: Object.values(PERMISSIONS).filter((roles) =>
    (roles as readonly string[]).includes(role),
  ).length,
}));

export function UsersManager({
  users,
  meta,
  staff,
  currentUserId,
  locale,
}: UsersManagerProps) {
  const router = useRouter();
  const filters = useListFilters();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | undefined>();
  const [deleting, setDeleting] = React.useState<UserRow | undefined>();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({ defaultValues: defaultsFor() });

  React.useEffect(() => {
    if (formOpen) reset(defaultsFor(editing));
  }, [formOpen, editing, reset]);

  async function onSubmit(values: UserFormValues) {
    // On edit, an empty password field means "leave the password unchanged".
    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      role: values.role,
      status: values.status,
      phone: values.phone || undefined,
      staff: values.staff === "none" ? null : values.staff,
    };
    if (values.password) payload.password = values.password;

    try {
      const { message } = editing
        ? await api.patch(`/api/users/${editing._id}`, payload)
        : await api.post("/api/users", payload);
      toast.success(message);
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the account.");
      }
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { message } = await api.delete(`/api/users/${deleting._id}`);
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not delete the account.",
      );
    }
  }

  return (
    <>
      <Card className="mb-4 gap-0 py-4">
        <div className="px-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-4" />
            Role permissions
          </p>
          <ul className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            {ROLE_PERMISSION_COUNTS.map((entry) => (
              <li key={entry.role} className="rounded-lg border px-2.5 py-2">
                <span className="block font-medium text-foreground">
                  {label(entry.role)}
                </span>
                {entry.count} permission(s)
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search name or email…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{ role: filters.get("role"), status: filters.get("status") }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            { key: "role", placeholder: "Any role", options: enumOptions(USER_ROLES) },
            { key: "status", placeholder: "Any status", options: enumOptions(USER_STATUSES) },
          ]}
        >
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {users.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No accounts match those filters"
              description="Create login accounts for the people who use this system."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Linked staff</TableHead>
                      <TableHead>Last signed in</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {user._id === currentUserId && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{label(user.role)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.staff
                            ? `${user.staff.firstName} ${user.staff.lastName}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(user.lastLoginAt, locale)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={user.status} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${user.name}`}
                              >
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(user);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              {user._id !== currentUserId && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleting(user)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
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
              <DataPagination meta={meta} onPageChange={filters.setPage} itemLabel="accounts" />
            </>
          )}
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Create an account"}</DialogTitle>
            <DialogDescription>
              The role decides which pages and actions this person can reach.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="userName">Full name</Label>
              <Input id="userName" {...register("name", { required: "Enter a name" })} />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                {...register("email", { required: "Enter an email address" })}
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userPassword">
                {editing ? "New password (leave blank to keep)" : "Password"}
              </Label>
              <Input
                id="userPassword"
                type="password"
                autoComplete="new-password"
                {...register("password", {
                  required: editing ? false : "Set an initial password",
                })}
              />
              <FieldError message={errors.password?.message} />
              <p className="text-xs text-muted-foreground">
                At least 8 characters, with an uppercase letter, a lowercase letter and a
                number.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="userRole">Role</Label>
                <Select value={watch("role")} onValueChange={(value) => setValue("role", value)}>
                  <SelectTrigger id="userRole" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {label(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="userStatus">Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value) => setValue("status", value)}
                >
                  <SelectTrigger id="userStatus" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {label(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userPhone">Phone</Label>
              <Input id="userPhone" {...register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userStaff">Linked staff record</Label>
              <Select value={watch("staff")} onValueChange={(value) => setValue("staff", value)}>
                <SelectTrigger id="userStaff" className="w-full">
                  <SelectValue placeholder="Not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.firstName} {member.lastName} · {member.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking a housekeeper lets them see the rooms assigned to them.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete ${deleting?.name}?`}
        description="They will lose access immediately. The last active administrator cannot be deleted."
        confirmLabel="Delete account"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
