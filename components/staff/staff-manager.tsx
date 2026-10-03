"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Ellipsis, LoaderCircle, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { SortableHeader } from "@/components/shared/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FieldError } from "@/components/shared/field-error";
import { useListFilters } from "@/hooks/use-list-filters";
import { formResolver } from "@/lib/form";
import { staffSchema, type StaffInput } from "@/schemas/staff";
import { DEPARTMENTS, STAFF_STATUSES, USER_ROLES, label } from "@/lib/constants";
import { formatStayDate, toDateInputValue } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { applyServerFieldErrors } from "@/lib/form-errors";

export interface StaffRow {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation?: string;
  joiningDate: string;
  status: string;
  shift?: string;
  address?: string;
  notes?: string;
  user?: { email: string; role: string; status: string } | null;
}

interface StaffManagerProps {
  staff: StaffRow[];
  meta: PaginationMeta;
  locale: string;
  permissions: { manage: boolean; remove: boolean };
}

type StaffFormValues = Omit<StaffInput, "joiningDate"> & { joiningDate: string };

function defaultsFor(member?: StaffRow): StaffFormValues {
  return {
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    role: (member?.role as StaffInput["role"]) ?? "RECEPTIONIST",
    department: (member?.department as StaffInput["department"]) ?? "Front Desk",
    designation: member?.designation ?? "",
    joiningDate: toDateInputValue(member?.joiningDate) || toDateInputValue(new Date()),
    status: (member?.status as StaffInput["status"]) ?? "ACTIVE",
    salary: undefined,
    shift: member?.shift ?? "",
    address: member?.address ?? "",
    notes: member?.notes ?? "",
  };
}

export function StaffManager({ staff, meta, locale, permissions }: StaffManagerProps) {
  const router = useRouter();
  const filters = useListFilters();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffRow | undefined>();
  const [deleting, setDeleting] = React.useState<StaffRow | undefined>();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: formResolver(staffSchema as never),
    defaultValues: defaultsFor(),
  });

  React.useEffect(() => {
    if (formOpen) reset(defaultsFor(editing));
  }, [formOpen, editing, reset]);

  async function onSubmit(values: StaffFormValues) {
    try {
      const { message } = editing
        ? await api.patch(`/api/staff/${editing._id}`, values)
        : await api.post("/api/staff", values);
      toast.success(message);
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        applyServerFieldErrors(error, setError);
        toast.error(error.message);
      } else {
        toast.error("Could not save the staff member.");
      }
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const { message } = await api.delete(`/api/staff/${deleting._id}`);
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not remove the record.",
      );
    }
  }

  const sort = filters.get("sort");
  const order = filters.get("order");

  return (
    <>
      <div className="space-y-3">
        <ListToolbar
          searchPlaceholder="Search name, email or employee id…"
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          filterValues={{
            department: filters.get("department"),
            role: filters.get("role"),
            status: filters.get("status"),
          }}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          activeFilterCount={filters.activeFilterCount}
          isPending={filters.isPending}
          filters={[
            {
              key: "department",
              placeholder: "Any department",
              options: DEPARTMENTS.map((d) => ({ value: d, label: d })),
            },
            { key: "role", placeholder: "Any role", options: enumOptions(USER_ROLES) },
            { key: "status", placeholder: "Any status", options: enumOptions(STAFF_STATUSES) },
          ]}
        >
          {permissions.manage && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add staff
            </Button>
          )}
        </ListToolbar>

        <Card className="overflow-hidden p-0">
          {staff.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff match those filters"
              description="Add the people who work at this property."
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
                        Name
                      </SortableHeader>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <SortableHeader
                        field="joiningDate"
                        currentSort={sort}
                        currentOrder={order}
                        onSort={filters.setSort}
                      >
                        Joined
                      </SortableHeader>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member._id}>
                        <TableCell>
                          <p className="font-medium">
                            {member.firstName} {member.lastName}
                          </p>
                          {member.designation && (
                            <p className="text-xs text-muted-foreground">
                              {member.designation}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {member.employeeId}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.department}
                        </TableCell>
                        <TableCell>{label(member.role)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{member.phone}</p>
                          <p className="max-w-44 truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatStayDate(member.joiningDate, locale)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell>
                          {permissions.manage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${member.firstName} ${member.lastName}`}
                                >
                                  <Ellipsis className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(member);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                                {permissions.remove && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleting(member)}
                                  >
                                    <Trash2 className="size-4" />
                                    Remove
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
              <DataPagination
                meta={meta}
                onPageChange={filters.setPage}
                itemLabel="staff members"
              />
            </>
          )}
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Edit ${editing.firstName} ${editing.lastName}`
                : "Add a staff member"}
            </DialogTitle>
            <DialogDescription>
              An employee ID is assigned automatically. A login account is created
              separately under Users & Roles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staffFirstName">First name</Label>
                <Input id="staffFirstName" {...register("firstName")} />
                <FieldError message={errors.firstName?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffLastName">Last name</Label>
                <Input id="staffLastName" {...register("lastName")} />
                <FieldError message={errors.lastName?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffEmail">Email</Label>
                <Input id="staffEmail" type="email" {...register("email")} />
                <FieldError message={errors.email?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffPhone">Phone</Label>
                <Input id="staffPhone" {...register("phone")} />
                <FieldError message={errors.phone?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffDepartment">Department</Label>
                <Select
                  value={watch("department")}
                  onValueChange={(value) =>
                    setValue("department", value as StaffInput["department"])
                  }
                >
                  <SelectTrigger id="staffDepartment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffRole">Role</Label>
                <Select
                  value={watch("role")}
                  onValueChange={(value) => setValue("role", value as StaffInput["role"])}
                >
                  <SelectTrigger id="staffRole" className="w-full">
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
                <Label htmlFor="staffDesignation">Designation</Label>
                <Input
                  id="staffDesignation"
                  placeholder="Front Desk Executive"
                  {...register("designation")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffShift">Shift</Label>
                <Input id="staffShift" placeholder="Morning" {...register("shift")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffJoiningDate">Joining date</Label>
                <Input id="staffJoiningDate" type="date" {...register("joiningDate")} />
                <FieldError message={errors.joiningDate?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffStatus">Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value) =>
                    setValue("status", value as StaffInput["status"])
                  }
                >
                  <SelectTrigger id="staffStatus" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {label(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staffAddress">Address</Label>
              <Input id="staffAddress" {...register("address")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staffNotes">Notes</Label>
              <Textarea id="staffNotes" rows={2} {...register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Add staff member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Remove ${deleting?.firstName} ${deleting?.lastName}?`}
        description="Staff with open housekeeping tasks or a login account cannot be removed until those are dealt with."
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
