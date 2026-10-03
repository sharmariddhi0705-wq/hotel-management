import { connectToDatabase } from "@/lib/mongodb";
import {
  Guest,
  HousekeepingTask,
  Invoice,
  Payment,
  Reservation,
  Room,
  RoomType,
  Staff,
  User,
} from "@/models";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/api-response";
import { buildSearchFilter, buildSort, escapeRegex, serialise } from "@/lib/query";
import { round2 } from "@/lib/pricing";
import { todayUtc } from "@/lib/dates";
import type { SortOrder } from "mongoose";

/**
 * Shared read layer.
 *
 * Both the API route handlers and the server components that render the list
 * pages call these functions, so a filter or a projection is defined exactly
 * once. Everything returned is already plain JSON, safe to hand to a client
 * component.
 */

export interface ListResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface BaseListQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order: "asc" | "desc";
}

function skipFor(query: BaseListQuery): number {
  return (query.page - 1) * query.limit;
}

/* ------------------------------------------------------------------ rooms */

const ROOM_SORTABLE = ["roomNumber", "floor", "pricePerNight", "status", "createdAt"] as const;

export interface RoomListQuery extends BaseListQuery {
  status?: string;
  housekeepingStatus?: string;
  roomType?: string;
  floor?: number;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
}

export function buildRoomFilter(query: RoomListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, ["roomNumber", "description"]),
  };
  if (query.status) filter.status = query.status;
  if (query.housekeepingStatus) filter.housekeepingStatus = query.housekeepingStatus;
  if (query.roomType) filter.roomType = query.roomType;
  if (query.floor !== undefined) filter.floor = query.floor;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.pricePerNight = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  return filter;
}

export async function fetchRooms(query: RoomListQuery) {
  await connectToDatabase();
  const filter = buildRoomFilter(query);
  const sort = buildSort(query.sort, query.order, ROOM_SORTABLE, {
    floor: 1,
    roomNumber: 1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    Room.find(filter)
      .populate("roomType", "name slug basePrice capacityAdults capacityChildren")
      .populate("assignedHousekeeper", "firstName lastName employeeId")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Room.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/** Floors that actually have rooms, for the floor filter dropdown. */
export async function fetchRoomFloors(): Promise<number[]> {
  await connectToDatabase();
  const floors = await Room.distinct("floor");
  return (floors as number[]).sort((a, b) => a - b);
}

export async function fetchRoomTypeOptions() {
  await connectToDatabase();
  const types = await RoomType.find({ isActive: true })
    .select("name basePrice capacityAdults capacityChildren amenities")
    .sort({ basePrice: 1 })
    .lean();
  return serialise(types);
}

/* -------------------------------------------------------------- room types */

const ROOM_TYPE_SORTABLE = ["name", "basePrice", "capacityAdults", "createdAt"] as const;

export async function fetchRoomTypes(query: BaseListQuery) {
  await connectToDatabase();
  const filter = buildSearchFilter(query.search, ["name", "description", "bedType"]);
  const sort = buildSort(query.sort, query.order, ROOM_TYPE_SORTABLE, {
    basePrice: 1,
  } as Record<string, SortOrder>);

  const [rows, total] = await Promise.all([
    RoomType.find(filter).sort(sort).skip(skipFor(query)).limit(query.limit).lean(),
    RoomType.countDocuments(filter),
  ]);

  const counts = await Room.aggregate<{ _id: unknown; count: number }>([
    { $match: { roomType: { $in: rows.map((r) => r._id) } } },
    { $group: { _id: "$roomType", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return {
    data: serialise(rows.map((r) => ({ ...r, roomCount: countMap.get(String(r._id)) ?? 0 }))),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/* ----------------------------------------------------------------- guests */

const GUEST_SORTABLE = ["lastName", "firstName", "createdAt", "totalStays", "totalSpend"] as const;

/**
 * Fields the guest list exposes.
 *
 * ID numbers, dates of birth and notes are omitted: the table does not show
 * them, so they are not sent to the browser. The detail view fetches them
 * separately when a user deliberately opens a profile.
 */
export const GUEST_LIST_PROJECTION =
  "firstName lastName email phone city country nationality isVip blacklisted totalStays totalSpend createdAt";

export interface GuestListQuery extends BaseListQuery {
  country?: string;
  isVip?: boolean;
  blacklisted?: boolean;
}

export function buildGuestFilter(query: GuestListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, ["firstName", "lastName", "email", "phone"]),
  };
  if (query.country) filter.country = query.country;
  if (query.isVip !== undefined) filter.isVip = query.isVip;
  if (query.blacklisted !== undefined) filter.blacklisted = query.blacklisted;
  return filter;
}

export async function fetchGuests(query: GuestListQuery) {
  await connectToDatabase();
  const filter = buildGuestFilter(query);
  const sort = buildSort(query.sort, query.order, GUEST_SORTABLE, {
    createdAt: -1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    Guest.find(filter)
      .select(GUEST_LIST_PROJECTION)
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Guest.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

export async function fetchGuestCountries(): Promise<string[]> {
  await connectToDatabase();
  const countries = await Guest.distinct("country", { country: { $nin: [null, ""] } });
  return (countries as string[]).sort();
}

/* ----------------------------------------------------------- reservations */

const RESERVATION_SORTABLE = [
  "reservationNumber",
  "checkInDate",
  "checkOutDate",
  "totalAmount",
  "createdAt",
] as const;

export interface ReservationListQuery extends BaseListQuery {
  reservationStatus?: string;
  paymentStatus?: string;
  guest?: string;
  room?: string;
  from?: Date;
  to?: Date;
  view?: "all" | "arrivals" | "departures" | "inhouse";
}

/**
 * Reservation filter.
 *
 * A free-text search must also match the guest or the room, which live in other
 * collections. Their ids are resolved first and folded into a `$or`, which keeps
 * the main query index-friendly instead of forcing an aggregation with `$lookup`.
 */
export async function buildReservationFilter(
  query: ReservationListQuery,
): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};
  const or: Record<string, unknown>[] = [];

  if (query.search?.trim()) {
    or.push({ reservationNumber: new RegExp(escapeForOr(query.search), "i") });

    const [guests, rooms] = await Promise.all([
      Guest.find(buildSearchFilter(query.search, ["firstName", "lastName", "email", "phone"]))
        .select("_id")
        .limit(200)
        .lean(),
      Room.find(buildSearchFilter(query.search, ["roomNumber"])).select("_id").limit(200).lean(),
    ]);

    if (guests.length) or.push({ guest: { $in: guests.map((g) => g._id) } });
    if (rooms.length) or.push({ room: { $in: rooms.map((r) => r._id) } });
  }
  if (or.length) filter.$or = or;

  if (query.reservationStatus) filter.reservationStatus = query.reservationStatus;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.guest) filter.guest = query.guest;
  if (query.room) filter.room = query.room;

  if (query.to) filter.checkInDate = { $lte: query.to };
  if (query.from) filter.checkOutDate = { $gte: query.from };

  const today = todayUtc();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  if (query.view === "arrivals") {
    filter.checkInDate = { $gte: today, $lt: tomorrow };
    filter.reservationStatus = query.reservationStatus ?? { $in: ["PENDING", "CONFIRMED"] };
  } else if (query.view === "departures") {
    filter.checkOutDate = { $gte: today, $lt: tomorrow };
    filter.reservationStatus = query.reservationStatus ?? "CHECKED_IN";
  } else if (query.view === "inhouse") {
    filter.reservationStatus = "CHECKED_IN";
  }

  return filter;
}

function escapeForOr(value: string): string {
  return escapeRegex(value.trim());
}

export async function fetchReservations(query: ReservationListQuery) {
  await connectToDatabase();
  const filter = await buildReservationFilter(query);
  const sort = buildSort(query.sort, query.order, RESERVATION_SORTABLE, {
    createdAt: -1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    Reservation.find(filter)
      .populate("guest", "firstName lastName email phone isVip")
      .populate("room", "roomNumber floor")
      .populate("roomType", "name")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Reservation.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/* --------------------------------------------------------------- payments */

const PAYMENT_SORTABLE = ["paymentDate", "amount", "method", "status", "createdAt"] as const;

export interface PaymentListQuery extends BaseListQuery {
  method?: string;
  status?: string;
  kind?: string;
  reservation?: string;
  guest?: string;
  from?: Date;
  to?: Date;
}

export function buildPaymentFilter(query: PaymentListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, ["paymentId", "transactionId", "notes"]),
  };
  if (query.method) filter.method = query.method;
  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  if (query.reservation) filter.reservation = query.reservation;
  if (query.guest) filter.guest = query.guest;
  if (query.from || query.to) {
    filter.paymentDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  return filter;
}

export async function fetchPayments(query: PaymentListQuery) {
  await connectToDatabase();
  const filter = buildPaymentFilter(query);
  const sort = buildSort(query.sort, query.order, PAYMENT_SORTABLE, {
    paymentDate: -1,
  } as Record<string, SortOrder>);

  const [data, total, totalsByKind] = await Promise.all([
    Payment.find(filter)
      .populate("guest", "firstName lastName phone")
      .populate("reservation", "reservationNumber totalAmount balanceDue")
      .populate("receivedBy", "name")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate<{ _id: string; total: number }>([
      { $match: { ...filter, status: "COMPLETED" } },
      { $group: { _id: "$kind", total: { $sum: "$amount" } } },
    ]),
  ]);

  const collected = totalsByKind.find((t) => t._id === "PAYMENT")?.total ?? 0;
  const refunded = totalsByKind.find((t) => t._id === "REFUND")?.total ?? 0;

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
    summary: {
      collected: round2(collected),
      refunded: round2(refunded),
      net: round2(collected - refunded),
    },
  };
}

/* --------------------------------------------------------------- invoices */

const INVOICE_SORTABLE = [
  "invoiceNumber",
  "invoiceDate",
  "totalAmount",
  "balanceDue",
  "status",
] as const;

export interface InvoiceListQuery extends BaseListQuery {
  status?: string;
  guest?: string;
  from?: Date;
  to?: Date;
}

export function buildInvoiceFilter(query: InvoiceListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, ["invoiceNumber", "guestSnapshot.name"]),
  };
  if (query.status) filter.status = query.status;
  if (query.guest) filter.guest = query.guest;
  if (query.from || query.to) {
    filter.invoiceDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  return filter;
}

export async function fetchInvoices(query: InvoiceListQuery) {
  await connectToDatabase();
  const filter = buildInvoiceFilter(query);
  const sort = buildSort(query.sort, query.order, INVOICE_SORTABLE, {
    invoiceDate: -1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    Invoice.find(filter)
      .populate("reservation", "reservationNumber reservationStatus")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/* ------------------------------------------------------------------ staff */

const STAFF_SORTABLE = ["lastName", "firstName", "department", "joiningDate", "status"] as const;

export interface StaffListQuery extends BaseListQuery {
  department?: string;
  role?: string;
  status?: string;
}

export function buildStaffFilter(query: StaffListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, [
      "firstName",
      "lastName",
      "email",
      "phone",
      "employeeId",
    ]),
  };
  if (query.department) filter.department = query.department;
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  return filter;
}

export async function fetchStaff(query: StaffListQuery) {
  await connectToDatabase();
  const filter = buildStaffFilter(query);
  const sort = buildSort(query.sort, query.order, STAFF_SORTABLE, {
    lastName: 1,
    firstName: 1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    Staff.find(filter)
      .populate("user", "email role status")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    Staff.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/** Active housekeepers, for the assignment dropdowns. */
export async function fetchHousekeepers() {
  await connectToDatabase();
  const staff = await Staff.find({ department: "Housekeeping", status: "ACTIVE" })
    .select("firstName lastName employeeId")
    .sort({ firstName: 1 })
    .lean();
  return serialise(staff);
}

/* ------------------------------------------------------------------ users */

const USER_SORTABLE = ["name", "email", "role", "status", "createdAt", "lastLoginAt"] as const;

export interface UserListQuery extends BaseListQuery {
  role?: string;
  status?: string;
}

export function buildUserFilter(query: UserListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(query.search, ["name", "email", "phone"]),
  };
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  return filter;
}

export async function fetchUsers(query: UserListQuery) {
  await connectToDatabase();
  const filter = buildUserFilter(query);
  const sort = buildSort(query.sort, query.order, USER_SORTABLE, {
    createdAt: -1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    User.find(filter)
      .populate("staff", "employeeId firstName lastName department")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/* ----------------------------------------------------------- housekeeping */

const TASK_SORTABLE = ["scheduledFor", "priority", "status", "createdAt"] as const;

export interface TaskListQuery extends BaseListQuery {
  status?: string;
  priority?: string;
  type?: string;
  assignedTo?: string;
  room?: string;
  from?: Date;
  to?: Date;
}

export function buildTaskFilter(query: TaskListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.type) filter.type = query.type;
  if (query.room) filter.room = query.room;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.from || query.to) {
    filter.scheduledFor = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  return filter;
}

export async function fetchHousekeepingTasks(query: TaskListQuery) {
  await connectToDatabase();
  const filter = buildTaskFilter(query);
  const sort = buildSort(query.sort, query.order, TASK_SORTABLE, {
    scheduledFor: 1,
  } as Record<string, SortOrder>);

  const [data, total] = await Promise.all([
    HousekeepingTask.find(filter)
      .populate("room", "roomNumber floor status housekeepingStatus")
      .populate("assignedTo", "firstName lastName employeeId")
      .sort(sort)
      .skip(skipFor(query))
      .limit(query.limit)
      .lean(),
    HousekeepingTask.countDocuments(filter),
  ]);

  return {
    data: serialise(data),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}
