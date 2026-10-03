/**
 * Shared enumerations and labels.
 *
 * These are the single source of truth for every status value in the system:
 * Mongoose schemas, Zod schemas and the UI all derive from the arrays below,
 * so adding a value in one place propagates everywhere.
 */

export const USER_ROLES = [
  "ADMIN",
  "MANAGER",
  "RECEPTIONIST",
  "HOUSEKEEPING",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ROOM_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "CLEANING",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const HOUSEKEEPING_STATUSES = [
  "CLEAN",
  "DIRTY",
  "IN_PROGRESS",
  "INSPECTED",
  "MAINTENANCE_REQUIRED",
] as const;
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export const TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = [
  "CLEANING",
  "TURNDOWN",
  "DEEP_CLEAN",
  "INSPECTION",
  "MAINTENANCE",
  "LINEN_CHANGE",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Statuses that occupy a room on the calendar and therefore block bookings. */
export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIAL",
  "PAID",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_RECORD_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const PAYMENT_KINDS = ["PAYMENT", "REFUND"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DEPARTMENTS = [
  "Front Desk",
  "Housekeeping",
  "Maintenance",
  "Management",
  "Food & Beverage",
  "Security",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const STAFF_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
export type Gender = (typeof GENDERS)[number];

export const ID_TYPES = [
  "PASSPORT",
  "DRIVING_LICENSE",
  "NATIONAL_ID",
  "AADHAAR",
  "VOTER_ID",
  "OTHER",
] as const;
export type IdType = (typeof ID_TYPES)[number];

export const AMENITIES = [
  "Air Conditioning",
  "Free WiFi",
  "Flat-screen TV",
  "Mini Bar",
  "Safe",
  "Coffee Maker",
  "Balcony",
  "Sea View",
  "City View",
  "Bathtub",
  "Rain Shower",
  "Work Desk",
  "Room Service",
  "Kitchenette",
  "Jacuzzi",
  "Private Pool",
  "Butler Service",
] as const;

/** Human-readable labels for status codes shown in the UI. */
export const LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  HOUSEKEEPING: "Housekeeping",
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance",
  OUT_OF_SERVICE: "Out of service",
  CLEAN: "Clean",
  DIRTY: "Dirty",
  IN_PROGRESS: "In progress",
  INSPECTED: "Inspected",
  MAINTENANCE_REQUIRED: "Maintenance required",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  COMPLETED: "Completed",
  FAILED: "Failed",
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially paid",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
  CLEANING_TASK: "Cleaning",
  TURNDOWN: "Turndown",
  DEEP_CLEAN: "Deep clean",
  INSPECTION: "Inspection",
  LINEN_CHANGE: "Linen change",
  MALE: "Male",
  FEMALE: "Female",
  UNDISCLOSED: "Undisclosed",
  PASSPORT: "Passport",
  DRIVING_LICENSE: "Driving licence",
  NATIONAL_ID: "National ID",
  AADHAAR: "Aadhaar",
  VOTER_ID: "Voter ID",
  PAYMENT: "Payment",
};

export function label(value?: string | null): string {
  if (!value) return "—";
  return LABELS[value] ?? value;
}

/** Default page size for every paginated list endpoint. */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
